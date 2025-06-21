import { saveChat } from "@/app/[domain]/chat/chatStore";
import { env } from "@/env.mjs";
import { SYSTEM_MESSAGE } from "@/features/chat/constants";
import { tools } from "@/features/chat/tools";
import { FileMentionData } from "@/features/chat/types";
import { getFileSource } from "@/features/search/fileSourceApi";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from "@ai-sdk/openai";
import { createLogger } from "@sourcebot/logger";
import { appendResponseMessages, CoreSystemMessage, extractReasoningMiddleware, Message, streamText, wrapLanguageModel } from "ai";

const logger = createLogger('chat-api');

const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
})


// Check if API key is configured
if (!env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY is not configured")
}

export async function POST(req: Request) {
    try {
        const requestBody = await req.json();
        const {
            messages: chatMessages,
            id,
        } = requestBody as {
            messages: Message[];
            id: string;
        }

        const annotations = chatMessages.flatMap((message) => message.annotations ?? []) as FileMentionData[];

        // @todo: we can probably cache files per chat session.
        // That way we don't have to refetch files for every message.
        const fileContext =
            (await Promise.all(
                annotations.map(async (file) => {
                    const { path, repo } = file;

                    // @todo(mt)
                    const fileSource = await getFileSource({
                        fileName: path,
                        repository: repo,
                        branch: 'HEAD',
                    }, SINGLE_TENANT_ORG_DOMAIN);

                    if (isServiceError(fileSource)) {
                        // @todo: handle this
                        logger.error("Error fetching file source:", fileSource)
                        return undefined;
                    }

                    return {
                        ...fileSource,
                        source: fileSource.source,
                    };

                }))
            ).filter((file) => file !== undefined);


        const model = anthropic("claude-sonnet-4-0");
        // const model = openai("gpt-4.1");

        const context: CoreSystemMessage[] = fileContext.map((file) => ({
            role: "system" as const,
            content: JSON.stringify(file),
        }));

        const messages = [
            SYSTEM_MESSAGE,
            ...context,
            ...chatMessages,
        ]

        const result = streamText({
            model: wrapLanguageModel({
                model,
                middleware: [
                    // @todo: not sure if this is needed?
                    extractReasoningMiddleware({
                        tagName: 'reasoning',
                    })
                ]
            }),
            messages,
            tools,
            temperature: 0.3, // Lower temperature for more focused reasoning
            maxTokens: 4000, // Increased for tool results and responses
            toolChoice: "auto", // Let the model decide when to use tools
            maxSteps: 20,
            onStepFinish: (step) => {
                logger.info(`Step finished: ${step.stepType} ${step.isContinued}`)
                if (step.toolCalls) {
                    logger.info(`Tool calls in step: ${step.toolCalls.length}`)
                }
                if (step.toolResults) {
                    logger.info(`Tool results in step: ${step.toolResults.length}`)
                }
            },
            onFinish: async ({ response }) => {
                await saveChat({
                    id,
                    messages: appendResponseMessages({
                        messages: chatMessages,
                        responseMessages: response.messages,
                    }),
                });
            }
        })

        return result.toDataStreamResponse({
            // @see: https://ai-sdk.dev/docs/troubleshooting/use-chat-an-error-occurred
            getErrorMessage: errorHandler
        })
    } catch (error) {
        logger.error("Error:", error)
        logger.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
        return new Response(JSON.stringify({
            error: "Failed to process chat request",
            details: error instanceof Error ? error.message : "Unknown error"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
}

function errorHandler(error: unknown) {
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
