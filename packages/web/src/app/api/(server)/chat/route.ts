import { sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { _getConfiguredLanguageModelsFull, updateChatMessages, updateChatName } from "@/features/chat/actions";
import { createAgentStream } from "@/features/chat/agent";
import { additionalChatRequestParamsSchema, SBChatMessage, SearchScope } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
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
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import * as Sentry from "@sentry/nextjs";
import { getTokenFromConfig } from "@sourcebot/crypto";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { LanguageModel } from "@sourcebot/schemas/v3/index.type";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    generateText,
    JSONValue,
    ModelMessage,
    StreamTextResult,
    UIMessageStreamOptions,
    UIMessageStreamWriter,
} from "ai";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const logger = createLogger('chat-api');

const chatRequestSchema = z.object({
    // These paramt
    messages: z.array(z.any()),
    id: z.string(),
    ...additionalChatRequestParamsSchema.shape,
})

export async function POST(req: Request) {
    const domain = req.headers.get("X-Org-Domain");
    if (!domain) {
        return serviceErrorResponse({
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_ORG_DOMAIN_HEADER,
            message: "Missing X-Org-Domain header",
        });
    }

    const requestBody = await req.json();
    const parsed = await chatRequestSchema.safeParseAsync(requestBody);
    if (!parsed.success) {
        return serviceErrorResponse(schemaValidationError(parsed.error));
    }

    const { messages, id, selectedSearchScopes, languageModelId } = parsed.data;
    const response = await chatHandler({
        messages,
        id,
        selectedSearchScopes,
        languageModelId,
    }, domain);

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return response;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mergeStreamAsync = async (stream: StreamTextResult<any, any>, writer: UIMessageStreamWriter<SBChatMessage>, options: UIMessageStreamOptions<SBChatMessage> = {}) => {
    await new Promise<void>((resolve) => writer.merge(stream.toUIMessageStream({
        ...options,
        onFinish: async () => {
            resolve();
        }
    })));
}

interface ChatHandlerProps {
    messages: SBChatMessage[];
    id: string;
    selectedSearchScopes: SearchScope[];
    languageModelId: string;
}

const chatHandler = ({ messages, id, selectedSearchScopes, languageModelId }: ChatHandlerProps, domain: string) => sew(async () =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    orgId: org.id,
                    id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.isReadonly) {
                return serviceErrorResponse({
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "Chat is readonly and cannot be edited.",
                });
            }

            const latestMessage = messages[messages.length - 1];
            const sources = latestMessage.parts
                .filter((part) => part.type === 'data-source')
                .map((part) => part.data);

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

            const { model, providerOptions, headers } = await getAISDKLanguageModelAndOptions(languageModelConfig, org.id);

            if (
                messages.length === 1 &&
                messages[0].role === "user" &&
                messages[0].parts.length >= 1 &&
                messages[0].parts[0].type === 'text'
            ) {
                const content = messages[0].parts[0].text;

                const title = await generateChatTitle(content, model);
                await updateChatName({
                    chatId: id,
                    name: title,
                }, domain);
            }

            const traceId = randomUUID();

            // Extract user messages and assistant answers.
            // We will use this as the context we carry between messages.
            const messageHistory =
                messages.map((message): ModelMessage | undefined => {
                    if (message.role === 'user') {
                        return {
                            role: 'user',
                            content: message.parts[0].type === 'text' ? message.parts[0].text : '',
                        };
                    }

                    if (message.role === 'assistant') {
                        const answerPart = getAnswerPartFromAssistantMessage(message, false);
                        if (answerPart) {
                            return {
                                role: 'assistant',
                                content: [answerPart]
                            }
                        }
                    }
                }).filter(message => message !== undefined);

            const stream = createUIMessageStream<SBChatMessage>({
                execute: async ({ writer }) => {
                    writer.write({
                        type: 'start',
                    });

                    const startTime = new Date();

                    const expandedReposArrays = await Promise.all(selectedSearchScopes.map(async (scope) => {
                        if (scope.type === 'repo') {
                            return [scope.value];
                        }

                        if (scope.type === 'reposet') {
                            const reposet = await prisma.searchContext.findFirst({
                                where: {
                                    orgId: org.id,
                                    name: scope.value
                                },
                                include: {
                                    repos: true
                                }
                            });

                            if (reposet) {
                                return reposet.repos.map(repo => repo.name);
                            }
                        }
                        
                        return [];
                    }));
                    const expandedRepos = expandedReposArrays.flat();

                    const researchStream = await createAgentStream({
                        model,
                        providerOptions,
                        headers,
                        inputMessages: messageHistory,
                        inputSources: sources,
                        searchScopeRepoNames: expandedRepos,
                        onWriteSource: (source) => {
                            writer.write({
                                type: 'data-source',
                                data: source,
                            });
                        },
                        traceId,
                    });

                    await mergeStreamAsync(researchStream, writer, {
                        sendReasoning: true,
                        sendStart: false,
                        sendFinish: false,
                    });

                    const totalUsage = await researchStream.totalUsage;

                    writer.write({
                        type: 'message-metadata',
                        messageMetadata: {
                            totalTokens: totalUsage.totalTokens,
                            totalInputTokens: totalUsage.inputTokens,
                            totalOutputTokens: totalUsage.outputTokens,
                            totalResponseTimeMs: new Date().getTime() - startTime.getTime(),
                            modelName: languageModelConfig.displayName ?? languageModelConfig.model,
                            selectedSearchScopes,
                            traceId,
                        }
                    })


                    writer.write({
                        type: 'finish',
                    });
                },
                onError: errorHandler,
                originalMessages: messages,
                onFinish: async ({ messages }) => {
                    await updateChatMessages({
                        chatId: id,
                        messages
                    }, domain);
                },
            });

            return createUIMessageStreamResponse({
                stream,
            });
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true
    ));

const generateChatTitle = async (message: string, model: AISDKLanguageModelV2) => {
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

const getAISDKLanguageModelAndOptions = async (config: LanguageModel, orgId: number): Promise<{
    model: AISDKLanguageModelV2,
    providerOptions?: Record<string, Record<string, JSONValue>>,
    headers?: Record<string, string>,
}> => {

    const { provider, model: modelId } = config;

    switch (provider) {
        case 'amazon-bedrock': {
            const aws = createAmazonBedrock({
                baseURL: config.baseUrl,
                region: config.region ?? env.AWS_REGION,
                accessKeyId: config.accessKeyId
                    ? await getTokenFromConfig(config.accessKeyId, orgId, prisma)
                    : env.AWS_ACCESS_KEY_ID,
                secretAccessKey: config.accessKeySecret
                    ? await getTokenFromConfig(config.accessKeySecret, orgId, prisma)
                    : env.AWS_SECRET_ACCESS_KEY,
            });

            return {
                model: aws(modelId),
            };
        }
        case 'anthropic': {
            const anthropic = createAnthropic({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.ANTHROPIC_API_KEY,
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
                headers: {
                    // @see: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#interleaved-thinking
                    'anthropic-beta': 'interleaved-thinking-2025-05-14',
                },
            };
        }
        case 'azure': {
            const azure = createAzure({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token, orgId, prisma)) : env.AZURE_API_KEY,
                apiVersion: config.apiVersion,
                resourceName: config.resourceName ?? env.AZURE_RESOURCE_NAME,
            });

            return {
                model: azure(modelId),
            };
        }
        case 'deepseek': {
            const deepseek = createDeepSeek({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token, orgId, prisma)) : env.DEEPSEEK_API_KEY,
            });

            return {
                model: deepseek(modelId),
            };
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.GOOGLE_GENERATIVE_AI_API_KEY,
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
                        keyFilename: await getTokenFromConfig(config.credentials, orgId, prisma),
                    }
                } : {}),
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
                        keyFilename: await getTokenFromConfig(config.credentials, orgId, prisma),
                    }
                } : {}),
            });

            return {
                model: vertexAnthropic(modelId),
            };
        }
        case 'mistral': {
            const mistral = createMistral({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.MISTRAL_API_KEY,
            });

            return {
                model: mistral(modelId),
            };
        }
        case 'openai': {
            const openai = createOpenAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.OPENAI_API_KEY,
            });

            return {
                model: openai(modelId),
                providerOptions: {
                    openai: {
                        reasoningEffort: 'high'
                    } satisfies OpenAIResponsesProviderOptions,
                },
            };
        }
        case 'openai-compatible': {
            const openai = createOpenAICompatible({
                baseURL: config.baseUrl,
                name: config.displayName ?? modelId,
            });

            return {
                model: openai.chatModel(modelId),
            }
        }
        case 'openrouter': {
            const openrouter = createOpenRouter({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.OPENROUTER_API_KEY,
            });

            return {
                model: openrouter(modelId),
            };
        }
        case 'xai': {
            const xai = createXai({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token, orgId, prisma)
                    : env.XAI_API_KEY,
            });

            return {
                model: xai(modelId),
            };
        }
    }
}

const errorHandler = (error: unknown) => {
    logger.error(error);
    Sentry.captureException(error);

    if (error == null) {
        return 'unknown error';
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return JSON.stringify(error);
}

