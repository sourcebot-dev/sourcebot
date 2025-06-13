import { createOpenAI } from "@ai-sdk/openai"
import { coreMessageSchema, CoreSystemMessage, extractReasoningMiddleware, streamText, wrapLanguageModel } from "ai"
import { env } from "@/env.mjs"
import { tools } from "@/features/chat/tools"
import { chatContextSchema, SYSTEM_MESSAGE } from "@/features/chat/constants"
import { z } from "zod"
import { getFileSource } from "@/features/search/fileSourceApi"
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants"
import { base64Decode, isServiceError } from "@/lib/utils"
import { createLogger } from "@sourcebot/logger"

const logger = createLogger('chat-api');

const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
});


// Check if API key is configured
if (!env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY is not configured")
}

const chatRequestSchema = z.object({
    messages: z.array(coreMessageSchema),
    context: chatContextSchema,
})

export async function POST(req: Request) {
    try {
        const requestBody = await req.json();
        const { messages, context: { files } } = chatRequestSchema.parse(requestBody);

        // @todo: we can probably cache files per chat session.
        // That way we don't have to refetch files for every message.
        const fileContext = files ? (
            await Promise.all(
                files.map(async (file) => {
                    const { path, repository, revision } = file;
                    const fileSource = await getFileSource({
                        fileName: path,
                        repository,
                        branch: revision,
                    }, SINGLE_TENANT_ORG_DOMAIN);

                    if (isServiceError(fileSource)) {
                        // @todo: handle this
                        logger.error("Error fetching file source:", fileSource)
                        return undefined;
                    }

                    return {
                        ...fileSource,
                        source: base64Decode(fileSource.source),
                    };

                }))
        ).filter((file) => file !== undefined) : [];

        const context: CoreSystemMessage[] = fileContext.map((file) => ({
            role: "system" as const,
            content: JSON.stringify(file),
        }));

        console.log(messages);

        const result = streamText({
            model: wrapLanguageModel({
                model: openai("o3-mini"),
                middleware: [
                    // @todo: not sure if this is needed?
                    extractReasoningMiddleware({
                        tagName: 'reasoning',
                    })
                ]
            }),
            messages: [
                SYSTEM_MESSAGE,
                ...context,
                ...messages
            ],
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

export function errorHandler(error: unknown) {
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
