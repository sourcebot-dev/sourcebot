import { saveChat } from "@/features/chat/chatStore";
import { env } from "@/env.mjs";
import { createSystemPrompt } from "@/features/chat/constants";
import { getTools } from "@/features/chat/tools";
import { FileMentionData } from "@/features/chat/types";
import { getFileSource } from "@/features/search/fileSourceApi";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from "@ai-sdk/openai";
import { createLogger } from "@sourcebot/logger";
import { appendResponseMessages, extractReasoningMiddleware, Message, streamText, wrapLanguageModel } from "ai";
import { getRepos } from "@/actions";
import { RepoIndexingStatus } from "@sourcebot/db";

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
            selectedRepos,
        } = requestBody as {
            messages: Message[];
            id: string;
            selectedRepos: string[];
        }

        const annotations = chatMessages.flatMap((message) => message.annotations ?? []) as FileMentionData[];

        // @todo: we can probably cache files per chat session.
        // That way we don't have to refetch files for every message.
        const files = annotations.length > 0 ?
            (await Promise.all(
                annotations.map(async (file) => {
                    const { path, repo, revision } = file;

                    const fileSource = await getFileSource({
                        fileName: path,
                        repository: repo,
                        branch: revision,
                    }, SINGLE_TENANT_ORG_DOMAIN);

                    if (isServiceError(fileSource)) {
                        // @todo: handle this
                        logger.error("Error fetching file source:", fileSource)
                        return undefined;
                    }

                    return {
                        ...fileSource,
                        path,
                        repo,
                        revision,
                    };

                }))
            ).filter((file) => file !== undefined) : undefined;


        // The set of repos that the AI has access to.
        const reposAccessibleToLLM = await (async () => {
            if (selectedRepos.length > 0) {
                return selectedRepos;
            }

            const repos = await getRepos(SINGLE_TENANT_ORG_DOMAIN, {
                status: [RepoIndexingStatus.INDEXED]
            });
            if (isServiceError(repos)) {
                logger.error("Error fetching repos:", repos)
                return [];
            }

            return repos.map((repo) => repo.repoName);
        })();

        // const model = anthropic("claude-sonnet-4-0");
        const model = openai("o3");

        const systemPrompt = createSystemPrompt({
            files,
            repos: reposAccessibleToLLM,
        });

        const messages = [
            {
                role: "system" as const,
                content: systemPrompt,
            },
            ...chatMessages,
        ];

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
            tools: getTools({ repos: selectedRepos }),
            // temperature: 0.3, // Lower temperature for more focused reasoning
            maxSteps: 20,
            maxTokens: env.SOURCEBOT_CHAT_MAX_OUTPUT_TOKENS, // Increased for tool results and responses
            toolChoice: "auto", // Let the model decide when to use tools
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
