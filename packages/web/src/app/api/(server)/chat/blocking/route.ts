import { sew } from "@/actions";
import { _getConfiguredLanguageModelsFull, _getAISDKLanguageModelAndOptions, updateChatMessages, generateAndUpdateChatNameFromMessage } from "@/features/chat/actions";
import { SBChatMessage, SearchScope } from "@/features/chat/types";
import { convertLLMOutputToPortableMarkdown, getAnswerPartFromAssistantMessage } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { requestBodySchemaValidationError, ServiceError, ServiceErrorException, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { getBaseUrl } from "@/lib/utils.server";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { ChatVisibility, Prisma } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createMessageStream } from "../route";
import { InferUIMessageChunk, UITools, UIDataTypes, UIMessage } from "ai";

const logger = createLogger('chat-blocking-api');

/**
 * Request schema for the blocking chat API.
 * This is a simpler interface designed for MCP and other programmatic integrations.
 */
const blockingChatRequestSchema = z.object({
    query: z
        .string()
        .describe("The query to ask about the codebase."),
    repos: z
        .array(z.string())
        .optional()
        .describe("The repositories that are accessible to the agent during the chat. If not provided, all repositories are accessible."),
});

/**
 * Response schema for the blocking chat API.
 */
interface BlockingChatResponse {
    answer: string;
    chatId: string;
    chatUrl: string;
}

/**
 * POST /api/chat/blocking
 * 
 * A blocking (non-streaming) chat endpoint designed for MCP and other integrations.
 * Creates a chat session, runs the agent to completion, and returns the final answer.
 * 
 * The chat session is persisted to the database, allowing users to view the full
 * conversation (including tool calls and reasoning) in the web UI.
 */
export async function POST(request: Request) {
    const requestBody = await request.json();
    const parsed = await blockingChatRequestSchema.safeParseAsync(requestBody);

    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const { query, repos = [] } = parsed.data;

    const response: BlockingChatResponse | ServiceError = await sew(() =>
        withOptionalAuthV2(async ({ org, user, prisma }) => {
            // Get all configured language models
            const configuredModels = await _getConfiguredLanguageModelsFull();
            if (configuredModels.length === 0) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "No language models are configured. Please configure at least one language model.",
                } satisfies ServiceError;
            }

            // @todo: we should probably have a option of passing the language model
            // into the request body. For now, just use the first configured model.
            const languageModelConfig = configuredModels[0];

            const { model, providerOptions } = await _getAISDKLanguageModelAndOptions(languageModelConfig);
            const modelName = languageModelConfig.displayName ?? languageModelConfig.model;

            // Create a new chat session
            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    createdById: user?.id,
                    visibility: ChatVisibility.PRIVATE,
                    messages: [] as unknown as Prisma.InputJsonValue,
                },
            });

            // Run the agent to completion
            logger.debug(`Starting blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
                query: query.substring(0, 100),
                model: modelName,
            });

            // Create the initial user message
            const userMessage: SBChatMessage = {
                id: randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text: query }],
            };

            const selectedSearchScopes: SearchScope[] = [];
            for (const repo of repos) {
                const repoDB = await prisma.repo.findFirst({
                    where: {
                        name: repo,
                    },
                });

                if (!repoDB) {
                    throw new ServiceErrorException({
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: `Repository '${repo}' not found.`,
                    })
                }

                selectedSearchScopes.push({
                    type: 'repo',
                    value: repoDB.name,
                    name: repoDB.displayName ?? repoDB.name.split('/').pop() ?? repoDB.name,
                    codeHostType: repoDB.external_codeHostType,
                })
            }

            // We'll capture the final messages and usage from the stream
            let finalMessages: SBChatMessage[] = [];

            const stream = await createMessageStream({
                messages: [userMessage],
                selectedSearchScopes,
                model,
                modelName,
                modelProviderOptions: providerOptions,
                orgId: org.id,
                prisma,
                onFinish: async ({ messages }) => {
                    finalMessages = messages;
                },
            })

            await Promise.all([
                // Consume the stream fully to trigger onFinish
                blockStreamUntilFinish(stream),
                // Generate and update the chat name
                generateAndUpdateChatNameFromMessage({
                    chatId: chat.id,
                    languageModelId: languageModelConfig.model,
                    message: query,
                })
            ]);

            // Persist the messages to the chat
            await updateChatMessages({
                chatId: chat.id,
                messages: finalMessages,
            });

            // Extract the answer text from the assistant message
            const assistantMessage = finalMessages.find(m => m.role === 'assistant');
            const answerPart = assistantMessage
                ? getAnswerPartFromAssistantMessage(assistantMessage, false)
                : undefined;
            const answerText = answerPart?.text ?? '';

            // Convert to portable markdown (replaces @file: references with markdown links)
            const portableAnswer = convertLLMOutputToPortableMarkdown(answerText);

            // Build the chat URL
            const headersList = await headers();
            const baseUrl = getBaseUrl(headersList);
            const chatUrl = `${baseUrl}/${org.domain}/chat/${chat.id}`;

            logger.debug(`Completed blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
            });

            return {
                answer: portableAnswer,
                chatId: chat.id,
                chatUrl,
            } satisfies BlockingChatResponse;
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return NextResponse.json(response);
}

const blockStreamUntilFinish = async <T extends UIMessage<unknown, UIDataTypes, UITools>>(stream: ReadableStream<InferUIMessageChunk<T>>) => {
    const reader = stream.getReader();
    while (true as const) {
        const { done } = await reader.read();
        if (done) break;
    }
}