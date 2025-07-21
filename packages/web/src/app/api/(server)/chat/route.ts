import { sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { _getConfiguredLanguageModelsFull, saveChatMessages, updateChatName } from "@/features/chat/actions";
import { createAgentStream } from "@/features/chat/agent";
import { additionalChatRequestParamsSchema, SBChatMessage } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { prisma } from "@/prisma";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { LanguageModelV2 as AISDKLanguageModelV2 } from "@ai-sdk/provider";
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

    const { messages, id, selectedRepos, languageModelId } = parsed.data;
    const response = await chatHandler({
        messages,
        id,
        selectedRepos,
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
    selectedRepos: string[];
    languageModelId: string;
}

const chatHandler = ({ messages, id, selectedRepos, languageModelId }: ChatHandlerProps, domain: string) => sew(async () =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
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

            // @todo: refactor this
            if (
                messages.length === 1 &&
                messages[0].role === "user" &&
                messages[0].parts.length >= 1 &&
                messages[0].parts[0].type === 'text'
            ) {
                const content = messages[0].parts[0].text;

                const title = await generateChatTitle(content, model);
                if (title) {
                    updateChatName({
                        chatId: id,
                        name: title,
                    }, domain);
                }
                else {
                    logger.error("Failed to generate chat title.");
                }
            }

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

            try {
                const stream = createUIMessageStream<SBChatMessage>({
                    execute: async ({ writer }) => {
                        writer.write({
                            type: 'start',
                        });

                        const startTime = new Date();

                        const researchStream = await createAgentStream({
                            model,
                            providerOptions,
                            headers,
                            inputMessages: messageHistory,
                            inputSources: sources,
                            selectedRepos,
                            onWriteSource: (source) => {
                                writer.write({
                                    type: 'data-source',
                                    data: source,
                                });
                            },
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
                            }
                        })


                        writer.write({
                            type: 'finish',
                        });
                    },
                    onError: errorHandler,
                    originalMessages: messages,
                    onFinish: async ({ messages }) => {
                        await saveChatMessages({
                            chatId: id,
                            messages
                        }, domain);
                    },
                });

                return createUIMessageStreamResponse({
                    stream,
                });
            } catch (error) {
                logger.error("Error:", error)
                logger.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

                return serviceErrorResponse({
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true
    ));

const generateChatTitle = async (message: string, model: AISDKLanguageModelV2) => {
    try {
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
            maxOutputTokens: 20,
        });

        return result.text;
    } catch (error) {
        logger.error("Error generating summary:", error)
        return undefined;
    }
}

const getAISDKLanguageModelAndOptions = async (config: LanguageModel, orgId: number): Promise<{
    model: AISDKLanguageModelV2,
    providerOptions?: Record<string, Record<string, JSONValue>>,
    headers?: Record<string, string>,
}> => {

    const { provider, model: modelId } = config;

    switch (provider) {
        case 'anthropic': {
            const anthropic = createAnthropic({
                baseURL: config.baseUrl,
                ...(config.token ? {
                    apiKey: (await getTokenFromConfig(config.token, orgId, prisma)),
                } : {
                    apiKey: env.ANTHROPIC_API_KEY,
                }),
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
        case 'openai': {
            const openai = createOpenAI({
                baseURL: config.baseUrl,
                ...(config.token ? {
                    apiKey: (await getTokenFromConfig(config.token, orgId, prisma)),
                } : {
                    apiKey: env.OPENAI_API_KEY,
                }),
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
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                baseURL: config.baseUrl,
                ...(config.token ? {
                    apiKey: (await getTokenFromConfig(config.token, orgId, prisma)),
                } : {
                    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
                }),
            });

            return {
                model: google(modelId),
            };
        }
        case 'amazon-bedrock': {
            const aws = createAmazonBedrock({
                baseURL: config.baseUrl,
                region: config.region ?? env.AWS_REGION,
                ...(config.accessKeyId ? {
                    accessKeyId: (await getTokenFromConfig(config.accessKeyId, orgId, prisma)),
                } : {
                    accessKeyId: env.AWS_ACCESS_KEY_ID,
                }),
                ...(config.accessKeySecret ? {
                    secretAccessKey: (await getTokenFromConfig(config.accessKeySecret, orgId, prisma)),
                } : {
                    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                }),
            });

            return {
                model: aws(modelId),
            };
        }
    }
}

const errorHandler = (error: unknown) => {
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

