import { sew } from "@/actions";
import { _getConfiguredLanguageModelsFull, _getAISDKLanguageModelAndOptions, _updateChatMessages, _isOwnerOfChat } from "@/features/chat/actions";
import { createAgentStream } from "@/features/chat/agent";
import { additionalChatRequestParamsSchema, LanguageModelInfo, SBChatMessage, SearchScope } from "@/features/chat/types";
import { getAnswerPartFromAssistantMessage, getLanguageModelKey, isContextWindowError, CONTEXT_WINDOW_USER_MESSAGE } from "@/features/chat/utils";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, requestBodySchemaValidationError, ServiceError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { LanguageModelV2 as AISDKLanguageModelV2 } from "@ai-sdk/provider";
import * as Sentry from "@sentry/nextjs";
import { PrismaClient } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import { captureEvent } from "@/lib/posthog";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    JSONValue,
    ModelMessage,
    StreamTextResult,
    UIMessageStreamOnFinishCallback,
    UIMessageStreamOptions,
    UIMessageStreamWriter
} from "ai";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";
import { z } from "zod";

const logger = createLogger('chat-api');

const chatRequestSchema = z.object({
    messages: z.array(z.any()),
    id: z.string(),
    ...additionalChatRequestParamsSchema.shape,
})

export const POST = apiHandler(async (req: NextRequest) => {
    const requestBody = await req.json();
    const parsed = await chatRequestSchema.safeParseAsync(requestBody);
    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const { messages, id, selectedSearchScopes, languageModel: _languageModel } = parsed.data;
    // @note: a bit of type massaging is required here since the
    // zod schema does not enum on `model` or `provider`.
    // @see: chat/types.ts
    const languageModel = _languageModel as LanguageModelInfo;

    const response = await sew(() =>
        withOptionalAuthV2(async ({ org, user, prisma }) => {
            // Validate that the chat exists.
            const chat = await prisma.chat.findUnique({
                where: {
                    orgId: org.id,
                    id,
                },
            });

            if (!chat) {
                return notFound();
            }

            // Check ownership - only the owner can send messages
            const isOwner = await _isOwnerOfChat(chat, user);
            if (!isOwner) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: 'Only the owner of a chat can send messages.',
                } satisfies ServiceError;
            }

            // From the language model ID, attempt to find the
            // corresponding config in `config.json`.
            const languageModelConfig =
                (await _getConfiguredLanguageModelsFull())
                    .find((model) => getLanguageModelKey(model) === getLanguageModelKey(languageModel));

            if (!languageModelConfig) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Language model ${languageModel.model} is not configured.`,
                } satisfies ServiceError;
            }

            const { model, providerOptions } = await _getAISDKLanguageModelAndOptions(languageModelConfig);

            await captureEvent('wa_chat_message_sent', {
                chatId: id,
                messageCount: messages.length,
            });

            const stream = await createMessageStream({
                chatId: id,
                messages,
                selectedSearchScopes,
                model,
                modelName: languageModelConfig.displayName ?? languageModelConfig.model,
                modelProviderOptions: providerOptions,
                orgId: org.id,
                prisma,
                onFinish: async ({ messages }) => {
                    await _updateChatMessages({ chatId: id, messages, prisma });
                },
                onError: (error: unknown) => {
                    logger.error(error);
                    Sentry.captureException(error);

                    if (error == null) {
                        return 'unknown error';
                    }

                    const errorMessage = (() => {
                        if (typeof error === 'string') return error;
                        if (error instanceof Error) return error.message;
                        return JSON.stringify(error);
                    })();

                    if (isContextWindowError(errorMessage)) {
                        return CONTEXT_WINDOW_USER_MESSAGE;
                    }

                    return errorMessage;
                }
            });

            return createUIMessageStreamResponse({
                stream,
            });
        })
    )

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return response;
});

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
    chatId: string;
    messages: SBChatMessage[];
    selectedSearchScopes: SearchScope[];
    model: AISDKLanguageModelV2;
    modelName: string;
    modelProviderOptions?: Record<string, Record<string, JSONValue>>;
    orgId: number;
    prisma: PrismaClient;
    onFinish: UIMessageStreamOnFinishCallback<SBChatMessage>;
    onError: (error: unknown) => string;
}

export const createMessageStream = async ({
    chatId,
    messages,
    selectedSearchScopes,
    model,
    modelName,
    modelProviderOptions,
    orgId,
    prisma,
    onFinish,
    onError,
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

    const maxMessages = env.SOURCEBOT_CHAT_MAX_MESSAGE_HISTORY;
    const trimmedMessageHistory = messageHistory.length > maxMessages
        ? messageHistory.slice(-maxMessages)
        : messageHistory;

    const stream = createUIMessageStream<SBChatMessage>({
        execute: async ({ writer }) => {
            writer.write({
                type: 'start',
            });

            const startTime = new Date();

            const expandedRepos = (await Promise.all(selectedSearchScopes.map(async (scope) => {
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
            }))).flat()

            const researchStream = await createAgentStream({
                model,
                providerOptions: modelProviderOptions,
                inputMessages: trimmedMessageHistory,
                inputSources: sources,
                selectedRepos: expandedRepos,
                onWriteSource: (source) => {
                    writer.write({
                        type: 'data-source',
                        data: source,
                    });
                },
                traceId,
                chatId,
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
        onError,
        originalMessages: messages,
        onFinish,
    });

    return stream;
};
