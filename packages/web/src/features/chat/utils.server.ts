import 'server-only';

import { getAnonymousId } from '@/lib/anonymousId';
import { createPostHogClient, tryGetPostHogDistinctId } from "@/lib/posthog";
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
import { LanguageModelV3 as AISDKLanguageModelV3 } from "@ai-sdk/provider";
import { createXai } from '@ai-sdk/xai';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { withTracing } from "@posthog/ai";
import { Chat, Prisma, PrismaClient, User } from '@sourcebot/db';
import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { Token } from "@sourcebot/schemas/v3/shared.type";
import { env, getTokenFromConfig, loadConfig } from '@sourcebot/shared';
import { extractReasoningMiddleware, generateText, JSONValue, wrapLanguageModel } from "ai";
import fs from 'fs';
import path from 'path';
import { LanguageModelInfo, SBChatMessage } from './types';

/**
 * Checks if the current user (authenticated or anonymous) is the owner of a chat.
 */
export const isOwnerOfChat = async (chat: Chat, user: User | undefined): Promise<boolean> => {
    // Authenticated user owns the chat
    if (user && chat.createdById === user.id) {
        return true;
    }

    // Only check the anonymous cookie for unclaimed chats (createdById === null).
    // Once a chat has been claimed by an authenticated user, the anonymous path
    // must not grant access — even if the same browser still holds the original cookie.
    if (!chat.createdById && chat.anonymousCreatorId) {
        const anonymousId = await getAnonymousId();
        if (anonymousId && chat.anonymousCreatorId === anonymousId) {
            return true;
        }
    }

    return false;
};

/**
 * Checks if a user has been explicitly shared access to a chat.
 */
export const isChatSharedWithUser = async ({
    prisma, chatId, userId,
}: {
    prisma: PrismaClient;
    chatId: string;
    userId?: string;
}): Promise<boolean> => {
    if (!userId) {
        return false;
    }

    const share = await prisma.chatAccess.findUnique({
        where: {
            chatId_userId: {
                chatId,
                userId,
            },
        },
    });

    return share !== null;
};

export const updateChatMessages = async ({
    prisma, chatId, messages,
}: {
    prisma: PrismaClient;
    chatId: string;
    messages: SBChatMessage[];
}) => {
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
};
/**
 * Returns the full configuration of the language models.
 *
 * @warning this can contain sensitive information like environment
 * variable names and base URLs. When passing information to the client,
 * use getConfiguredLanguageModelsInfo instead.
 */
export const getConfiguredLanguageModels = async (): Promise<LanguageModel[]> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return config.models ?? [];
    } catch (error) {
        console.error('Failed to load language model configuration', error);
        return [];
    }
};

/**
 * Returns the subset of information about the configured language models
 * that we can safely send to the client.
 */
export const getConfiguredLanguageModelsInfo = async () => {
    const models = await getConfiguredLanguageModels();
    return models.map((model): LanguageModelInfo => ({
        provider: model.provider,
        model: model.model,
        displayName: model.displayName,
    }));
};

export const generateChatNameFromMessage = async ({ message, languageModelConfig }: { message: string, languageModelConfig: LanguageModel }) => {
    const { model } = await getAISDKLanguageModelAndOptions(languageModelConfig);

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

    return result.text;
}

export const getAISDKLanguageModelAndOptions = async (config: LanguageModel): Promise<{
    model: AISDKLanguageModelV3,
    providerOptions?: Record<string, Record<string, JSONValue>>,
}> => {
    const { provider, model: modelId } = config;

    const { model: _model, providerOptions } = await (async (): Promise<{
        model: AISDKLanguageModelV3,
        providerOptions?: Record<string, Record<string, JSONValue>>,
    }> => {
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
                    authToken: config.authToken
                        ? await getTokenFromConfig(config.authToken)
                        : env.ANTHROPIC_AUTH_TOKEN,
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

                const reasoningSummary = config.reasoningSummary ?? 'auto';
                return {
                    model: azure(modelId),
                    providerOptions: {
                        openai: {
                            reasoningEffort: config.reasoningEffort ?? 'medium',
                            ...(reasoningSummary !== 'none' && { reasoningSummary }),
                        } satisfies OpenAIResponsesProviderOptions,
                    }
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
                        vertex: {
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

                const reasoningSummary = config.reasoningSummary ?? 'auto';
                return {
                    model: openai(modelId),
                    providerOptions: {
                        openai: {
                            reasoningEffort: config.reasoningEffort ?? 'medium',
                            ...(reasoningSummary !== 'none' && { reasoningSummary }),
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
    })();

    const posthog = await createPostHogClient();
    const distinctId = await tryGetPostHogDistinctId();

    // Only enable posthog LLM analytics for the ask GH experiment.
    const model = env.EXPERIMENT_ASK_GH_ENABLED === 'true' ?
        withTracing(_model, posthog, {
            posthogDistinctId: distinctId,
        }) :
        _model;

    return {
        model,
        providerOptions,
    };
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
};