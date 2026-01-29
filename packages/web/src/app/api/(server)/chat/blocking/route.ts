import { sew } from "@/actions";
import { _getConfiguredLanguageModelsFull, _getAISDKLanguageModelAndOptions, updateChatMessages } from "@/features/chat/actions";
import { runAgentBlocking } from "@/features/chat/agent";
import { ANSWER_TAG } from "@/features/chat/constants";
import { LanguageModelInfo, SBChatMessage, Source } from "@/features/chat/types";
import { convertLLMOutputToPortableMarkdown, getLanguageModelKey } from "@/features/chat/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { requestBodySchemaValidationError, ServiceError, serviceErrorResponse } from "@/lib/serviceError";
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

const logger = createLogger('chat-blocking-api');

/**
 * Request schema for the blocking chat API.
 * This is a simpler interface designed for MCP and other programmatic integrations.
 */
const blockingChatRequestSchema = z.object({
    // The question to ask about the codebase
    question: z.string().min(1, "Question is required"),
    // Optional: filter to specific repositories (by name)
    repos: z.array(z.string()).optional(),
    // Optional: specify a language model (defaults to first configured model)
    languageModel: z.object({
        provider: z.string(),
        model: z.string(),
        displayName: z.string().optional(),
    }).optional(),
});

/**
 * Response schema for the blocking chat API.
 */
interface BlockingChatResponse {
    // The agent's final answer (markdown format)
    answer: string;
    // ID of the persisted chat session
    chatId: string;
    // URL to view the chat in the web UI
    chatUrl: string;
    // Files the agent referenced during research
    sources: Source[];
    // Metadata about the response
    metadata: {
        totalTokens: number;
        inputTokens: number;
        outputTokens: number;
        totalResponseTimeMs: number;
        modelName: string;
    };
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

    const { question, repos, languageModel: requestedLanguageModel } = parsed.data;

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

            // Select the language model to use
            let languageModelConfig = configuredModels[0]; // Default to first configured model
            
            if (requestedLanguageModel) {
                const requested = requestedLanguageModel as LanguageModelInfo;
                const found = configuredModels.find(
                    (model) => getLanguageModelKey(model) === getLanguageModelKey(requested)
                );
                if (!found) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: `Language model ${requested.model} is not configured.`,
                    } satisfies ServiceError;
                }
                languageModelConfig = found;
            }

            
            const { model, providerOptions } = await _getAISDKLanguageModelAndOptions(languageModelConfig);
            const modelName = languageModelConfig.displayName ?? languageModelConfig.model;

            // Determine which repos to search
            let searchScopeRepoNames: string[];
            
            if (repos && repos.length > 0) {
                // Use the provided repos filter
                // Validate that these repos exist and the user has access
                const validRepos = await prisma.repo.findMany({
                    where: {
                        orgId: org.id,
                        name: {
                            in: repos,
                        },
                    },
                    select: { name: true },
                });
                
                searchScopeRepoNames = validRepos.map(r => r.name);
                
                if (searchScopeRepoNames.length === 0) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: "None of the specified repositories were found or accessible.",
                    } satisfies ServiceError;
                }
            } else {
                // Search all repos the user has access to
                const allRepos = await prisma.repo.findMany({
                    where: {
                        orgId: org.id,
                    },
                    select: { name: true },
                });
                searchScopeRepoNames = allRepos.map(r => r.name);
            }

            // Create a new chat session
            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    createdById: user?.id,
                    visibility: ChatVisibility.PRIVATE,
                    messages: [] as unknown as Prisma.InputJsonValue,
                },
            });

            const traceId = randomUUID();

            // Run the agent to completion
            logger.info(`Starting blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
                question: question.substring(0, 100),
                repoCount: searchScopeRepoNames.length,
                model: modelName,
            });

            const agentResult = await runAgentBlocking({
                model,
                providerOptions,
                searchScopeRepoNames,
                inputMessages: [{ role: 'user', content: question }],
                inputSources: [],
                traceId,
            });

            // Extract the answer (removing the answer tag if present)
            let answer = agentResult.text;
            if (answer.startsWith(ANSWER_TAG)) {
                answer = answer.slice(ANSWER_TAG.length).trim();
            }

            // Convert to portable markdown (replaces @file: references with markdown links)
            const portableAnswer = convertLLMOutputToPortableMarkdown(answer);

            // Build the chat URL
            const headersList = await headers();
            const baseUrl = getBaseUrl(headersList);
            const chatUrl = `${baseUrl}/${org.domain}/chat/${chat.id}`;

            // Create the message history for persistence
            const userMessage: SBChatMessage = {
                id: randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text: question }],
            };

            const assistantMessage: SBChatMessage = {
                id: randomUUID(),
                role: 'assistant',
                parts: [
                    { type: 'text', text: agentResult.text },
                    // Include sources as data parts
                    ...agentResult.sources.map((source) => ({
                        type: 'data-source' as const,
                        data: source,
                    })),
                ],
                metadata: {
                    totalTokens: agentResult.usage.totalTokens,
                    totalInputTokens: agentResult.usage.inputTokens,
                    totalOutputTokens: agentResult.usage.outputTokens,
                    totalResponseTimeMs: agentResult.responseTimeMs,
                    modelName,
                    traceId,
                },
            };

            // Persist the messages to the chat
            await updateChatMessages({
                chatId: chat.id,
                messages: [userMessage, assistantMessage],
            });

            logger.info(`Completed blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
                responseTimeMs: agentResult.responseTimeMs,
                totalTokens: agentResult.usage.totalTokens,
                sourceCount: agentResult.sources.length,
            });

            return {
                answer: portableAnswer,
                chatId: chat.id,
                chatUrl,
                sources: agentResult.sources,
                metadata: {
                    totalTokens: agentResult.usage.totalTokens,
                    inputTokens: agentResult.usage.inputTokens,
                    outputTokens: agentResult.usage.outputTokens,
                    totalResponseTimeMs: agentResult.responseTimeMs,
                    modelName,
                },
            } satisfies BlockingChatResponse;
        })
    );

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    console.log(response);

    return NextResponse.json(response);
}
