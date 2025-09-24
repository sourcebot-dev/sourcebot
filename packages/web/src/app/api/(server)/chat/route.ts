import { sew } from "@/sew";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { _getConfiguredLanguageModelsFull, _getAISDKLanguageModelAndOptions, updateChatMessages } from "@/features/chat/actions";
import { createAgentStream } from "@/features/chat/agent";
import { additionalChatRequestParamsSchema, SBChatMessage, SearchScope } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { prisma } from "@/prisma";
import { LanguageModelV2 as AISDKLanguageModelV2 } from "@ai-sdk/provider";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@sourcebot/logger";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    JSONValue,
    ModelMessage,
    StreamTextResult,
    UIMessageStreamOptions,
    UIMessageStreamWriter
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

    const response = await sew(() =>
        withOptionalAuthV2(async ({ org, prisma }) => {
            // Validate that the chat exists and is not readonly.
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

            const { model, providerOptions } = await _getAISDKLanguageModelAndOptions(languageModelConfig, org.id);

            return createMessageStreamResponse({
                messages,
                id,
                selectedSearchScopes,
                model,
                modelName: languageModelConfig.displayName ?? languageModelConfig.model,
                modelProviderOptions: providerOptions,
                domain,
                orgId: org.id,
            });
        })
    )

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

interface CreateMessageStreamResponseProps {
    messages: SBChatMessage[];
    id: string;
    selectedSearchScopes: SearchScope[];
    model: AISDKLanguageModelV2;
    modelName: string;
    modelProviderOptions?: Record<string, Record<string, JSONValue>>;
    domain: string;
    orgId: number;
}

const createMessageStreamResponse = async ({
    messages,
    id,
    selectedSearchScopes,
    model,
    modelName,
    modelProviderOptions,
    domain,
    orgId,
}: CreateMessageStreamResponseProps) => {
    const latestMessage = messages[messages.length - 1];
    const sources = latestMessage.parts
        .filter((part) => part.type === 'data-source')
        .map((part) => part.data);

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
                            orgId,
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
                providerOptions: modelProviderOptions,
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
                    modelName,
                    selectedSearchScopes,
                    traceId,
                }
            });

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
};

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

