import { sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { saveChatMessages, updateChatName } from "@/features/chat/actions";
import { createAgentStream } from "@/features/chat/agent";
import { SBChatMessage } from "@/features/chat/types";
import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { LanguageModelV2 } from "@ai-sdk/provider";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, JSONValue, StreamTextResult, UIMessageStreamOptions, UIMessageStreamWriter } from "ai";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

const logger = createLogger('chat-api');

const chatRequestSchema = z.object({
    messages: z.array(z.any()),
    id: z.string(),
    selectedRepos: z.array(z.string()),
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

    const { messages, id, selectedRepos } = parsed.data;
    const response = await chatHandler({
        messages,
        id,
        selectedRepos,
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


const chatHandler = ({ messages, id, selectedRepos }: { messages: SBChatMessage[], id: string, selectedRepos: string[] }, domain: string) => sew(async () =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async () => {
            const latestMessage = messages[messages.length - 1];
            const sources = latestMessage.parts
                .filter((part) => part.type === 'data-source')
                .map((part) => part.data);

            const { model, providerOptions, headers, displayName } = getModel();

            // @todo: refactor this
            if (
                messages.length === 1 &&
                messages[0].role === "user" &&
                messages[0].parts.length >= 1 &&
                messages[0].parts[0].type === 'text'
            ) {
                const content = messages[0].parts[0].text;

                logger.debug("Generating chat title...");
                const title = await generateChatTitle(content, model);
                if (title) {
                    logger.debug("Chat title generated:", title);
                    updateChatName({
                        chatId: id,
                        name: title,
                    }, domain);
                }
                else {
                    logger.debug("Failed to generate chat title.");
                }
            }

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
                            // @todo: we will need to incorporate the previous messages into the prompt.
                            inputMessages: convertToModelMessages([latestMessage]),
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
                                modelName: displayName,
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

const generateChatTitle = async (message: string, model: LanguageModelV2) => {
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

const getModel = (): {
    model: LanguageModelV2,
    displayName: string,
    providerOptions?: Record<string, Record<string, JSONValue>>,
    headers?: Record<string, string>,
} => {
    const providerInfo = getConfiguredModelProviderInfo();
    if (!providerInfo) {
        throw new Error("No model configured.");
    }

    const { provider, model } = providerInfo;

    switch (provider) {
        case 'anthropic': {
            const anthropic = createAnthropic({
                apiKey: env.ANTHROPIC_API_KEY,
            });

            return {
                model: anthropic(model),
                displayName: providerInfo.displayName ?? model,
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
                apiKey: env.OPENAI_API_KEY,
            });

            return {
                model: openai(model),
                displayName: providerInfo.displayName ?? model,
                providerOptions: {
                    openai: {
                        reasoningEffort: 'medium'
                    } satisfies OpenAIResponsesProviderOptions,
                },
            };
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
            });

            return {
                model: google(model),
                displayName: providerInfo.displayName ?? model,
            };
        }
        case 'aws-bedrock': {
            const aws = createAmazonBedrock({
                region: env.AWS_REGION,
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            });

            return {
                model: aws(model),
                displayName: providerInfo.displayName ?? model,
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

