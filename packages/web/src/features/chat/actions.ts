'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { SOURCEBOT_GUEST_USER_ID } from "@/lib/constants";
import { ErrorCode } from "@/lib/errorCodes";
import { chatIsReadonly, notFound, ServiceError, serviceErrorResponse } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModelV2 as AISDKLanguageModelV2 } from "@ai-sdk/provider";
import { createXai } from '@ai-sdk/xai';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getTokenFromConfig, createLogger, env } from "@sourcebot/shared";
import { ChatVisibility, OrgRole, Prisma } from "@sourcebot/db";
import { LanguageModel } from "@sourcebot/schemas/v3/languageModel.type";
import { Token } from "@sourcebot/schemas/v3/shared.type";
import { generateText, JSONValue, extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { loadConfig } from "@sourcebot/shared";
import fs from 'fs';
import { StatusCodes } from "http-status-codes";
import path from 'path';
import { LanguageModelInfo, SBChatMessage } from "./types";

const logger = createLogger('chat-actions');

export const createChat = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {

            const isGuestUser = userId === SOURCEBOT_GUEST_USER_ID;

            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    messages: [] as unknown as Prisma.InputJsonValue,
                    createdById: userId,
                    visibility: isGuestUser ? ChatVisibility.PUBLIC : ChatVisibility.PRIVATE,
                },
            });

            return {
                id: chat.id,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const getChatInfo = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            return {
                messages: chat.messages as unknown as SBChatMessage[],
                visibility: chat.visibility,
                name: chat.name,
                isReadonly: chat.isReadonly,
            };
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const updateChatMessages = async ({ chatId, messages }: { chatId: string, messages: SBChatMessage[] }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            if (chat.isReadonly) {
                return chatIsReadonly();
            }

            await prisma.chat.update({
                where: {
                    id: chatId,
                },
                data: {
                    messages: messages as unknown as Prisma.InputJsonValue,
                },
            });

            if (env.DEBUG_WRITE_CHAT_MESSAGES_TO_FILE) {
                const chatDir = path.join(env.DATA_CACHE_DIR, 'chats');
                if (!fs.existsSync(chatDir)) {
                    fs.mkdirSync(chatDir, { recursive: true });
                }

                const chatFile = path.join(chatDir, `${chatId}.json`);
                fs.writeFileSync(chatFile, JSON.stringify(messages, null, 2));
            }

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const getUserChatHistory = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chats = await prisma.chat.findMany({
                where: {
                    orgId: org.id,
                    createdById: userId,
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            });

            return chats.map((chat) => ({
                id: chat.id,
                createdAt: chat.createdAt,
                name: chat.name,
                visibility: chat.visibility,
            }))
        })
    )
);

export const updateChatName = async ({ chatId, name }: { chatId: string, name: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            if (chat.isReadonly) {
                return chatIsReadonly();
            }

            await prisma.chat.update({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
                data: {
                    name,
                },
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const generateAndUpdateChatNameFromMessage = async ({ chatId, languageModelId, message }: { chatId: string, languageModelId: string, message: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async () => {
            // From the language model ID, attempt to find the
            // corresponding config in `config.json`.
            const languageModelConfig =
                (await _getConfiguredLanguageModelsFull())
                    .find((model) => model.model === languageModelId);

            if (!languageModelConfig) {
                return serviceErrorResponse({
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Language model ${languageModelId} is not configured.`,
                });
            }

            const { model } = await _getAISDKLanguageModelAndOptions(languageModelConfig);

            const prompt = `Convert this question into a short topic title (max 50 characters). 

Rules:
- Do NOT include question words (what, where, how, why, when, which)
- Do NOT end with a question mark
- Capitalize the first letter of the title
- Focus on the subject/topic being discussed
- Make it sound like a file name or category

Examples:
"Where is the authentication code?" → "Authentication Code"
"How to setup the database?" → "Database Setup"
"What are the API endpoints?" → "API Endpoints"

User question: ${message}`;

            const result = await generateText({
                model,
                prompt,
            });

            await updateChatName({
                chatId,
                name: result.text,
            }, domain);

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true
    )
);

export const deleteChat = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            // Public chats cannot be deleted.
            if (chat.visibility === ChatVisibility.PUBLIC) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: 'You are not allowed to delete this chat.',
                } satisfies ServiceError;
            }

            // Only the creator of a chat can delete it.
            if (chat.createdById !== userId) {
                return notFound();
            }

            await prisma.chat.delete({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            return {
                success: true,
            }
        })
    )
);

export const submitFeedback = async ({
    chatId,
    messageId,
    feedbackType
}: {
    chatId: string,
    messageId: string,
    feedbackType: 'like' | 'dislike'
}, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            // When a chat is private, only the creator can submit feedback.
            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            const messages = chat.messages as unknown as SBChatMessage[];
            const updatedMessages = messages.map(message => {
                if (message.id === messageId && message.role === 'assistant') {
                    return {
                        ...message,
                        metadata: {
                            ...message.metadata,
                            feedback: [
                                ...(message.metadata?.feedback ?? []),
                                {
                                    type: feedbackType,
                                    timestamp: new Date().toISOString(),
                                    userId: userId,
                                }
                            ]
                        }
                    } satisfies SBChatMessage;
                }
                return message;
            });

            await prisma.chat.update({
                where: { id: chatId },
                data: {
                    messages: updatedMessages as unknown as Prisma.InputJsonValue,
                },
            });

            return { success: true };
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

/**
 * Returns the subset of information about the configured language models
 * that we can safely send to the client.
 */
export const getConfiguredLanguageModelsInfo = async (): Promise<LanguageModelInfo[]> => {
    const models = await _getConfiguredLanguageModelsFull();
    return models.map((model): LanguageModelInfo => ({
        provider: model.provider,
        model: model.model,
        displayName: model.displayName,
    }));
}

/**
 * Returns the full configuration of the language models.
 *
 * @warning Do NOT call this function from the client,
 * or pass the result of calling this function to the client.
 */
export const _getConfiguredLanguageModelsFull = async (): Promise<LanguageModel[]> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return config.models ?? [];
    } catch (error) {
        logger.error('Failed to load language model configuration', error);
        return [];
    }
}

export const _getAISDKLanguageModelAndOptions = async (config: LanguageModel): Promise<{
    model: AISDKLanguageModelV2,
    providerOptions?: Record<string, Record<string, JSONValue>>,
}> => {
    const { provider, model: modelId } = config;

    switch (provider) {
        case 'amazon-bedrock': {
            const aws = createAmazonBedrock({
                baseURL: config.baseUrl,
                region: config.region ?? env.AWS_REGION,
                accessKeyId: config.accessKeyId
                    ? await getTokenFromConfig(config.accessKeyId)
                    : env.AWS_ACCESS_KEY_ID,
                secretAccessKey: config.accessKeySecret
                    ? await getTokenFromConfig(config.accessKeySecret)
                    : env.AWS_SECRET_ACCESS_KEY,
                sessionToken: config.sessionToken
                    ? await getTokenFromConfig(config.sessionToken)
                    : env.AWS_SESSION_TOKEN,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
                // Fallback to the default Node.js credential provider chain if no credentials are provided.
                // See: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/#fromnodeproviderchain
                credentialProvider: !config.accessKeyId && !config.accessKeySecret && !config.sessionToken
                    ? fromNodeProviderChain()
                    : undefined,
            });

            return {
                model: aws(modelId),
            };
        }
        case 'anthropic': {
            const anthropic = createAnthropic({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.ANTHROPIC_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: anthropic(modelId),
                providerOptions: {
                    anthropic: {
                        thinking: {
                            type: "enabled",
                            budgetTokens: env.ANTHROPIC_THINKING_BUDGET_TOKENS,
                        }
                    } satisfies AnthropicProviderOptions,
                },
            };
        }
        case 'azure': {
            const azure = createAzure({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.AZURE_API_KEY,
                apiVersion: config.apiVersion,
                resourceName: config.resourceName ?? env.AZURE_RESOURCE_NAME,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: azure(modelId),
            };
        }
        case 'deepseek': {
            const deepseek = createDeepSeek({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.DEEPSEEK_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: deepseek(modelId),
            };
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.GOOGLE_GENERATIVE_AI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: google(modelId),
            };
        }
        case 'google-vertex': {
            const vertex = createVertex({
                project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                location: config.region ?? env.GOOGLE_VERTEX_REGION,
                ...(config.credentials ? {
                    googleAuthOptions: {
                        keyFilename: await getTokenFromConfig(config.credentials),
                    }
                } : {}),
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: vertex(modelId),
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingBudget: env.GOOGLE_VERTEX_THINKING_BUDGET_TOKENS,
                            includeThoughts: env.GOOGLE_VERTEX_INCLUDE_THOUGHTS === 'true',
                        }
                    }
                },
            };
        }
        case 'google-vertex-anthropic': {
            const vertexAnthropic = createVertexAnthropic({
                project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                location: config.region ?? env.GOOGLE_VERTEX_REGION,
                ...(config.credentials ? {
                    googleAuthOptions: {
                        keyFilename: await getTokenFromConfig(config.credentials),
                    }
                } : {}),
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: vertexAnthropic(modelId),
            };
        }
        case 'mistral': {
            const mistral = createMistral({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.MISTRAL_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: mistral(modelId),
            };
        }
        case 'openai': {
            const openai = createOpenAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.OPENAI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: openai(modelId),
                providerOptions: {
                    openai: {
                        reasoningEffort: config.reasoningEffort ?? 'medium',
                    } satisfies OpenAIResponsesProviderOptions,
                },
            };
        }
        case 'openai-compatible': {
            const openai = createOpenAICompatible({
                baseURL: config.baseUrl,
                name: config.displayName ?? modelId,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : undefined,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
                queryParams: config.queryParams
                    ? await extractLanguageModelKeyValuePairs(config.queryParams)
                    : undefined,
            });

            const model = wrapLanguageModel({
                model: openai.chatModel(modelId),
                middleware: [
                    extractReasoningMiddleware({
                        tagName: config.reasoningTag ?? 'think',
                    }),
                ]
            });

            return {
                model,
            }
        }
        case 'openrouter': {
            const openrouter = createOpenRouter({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.OPENROUTER_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: openrouter(modelId),
            };
        }
        case 'xai': {
            const xai = createXai({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.XAI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: xai(modelId),
            };
        }
    }
}

const extractLanguageModelKeyValuePairs = async (
    pairs: {
        [k: string]: string | Token;
    }
): Promise<Record<string, string>> => {
    const resolvedPairs: Record<string, string> = {};

    if (!pairs) {
        return resolvedPairs;
    }

    for (const [key, val] of Object.entries(pairs)) {
        if (typeof val === "string") {
            resolvedPairs[key] = val;
            continue;
        }

        const value = await getTokenFromConfig(val);
        resolvedPairs[key] = value;
    }

    return resolvedPairs;
}
