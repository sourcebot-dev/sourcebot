import { getRepos } from "@/actions";
import { env } from "@/env.mjs";
import { saveChat } from "@/features/chat/chatStore";
import { createSystemPrompt } from "@/features/chat/constants";
import { getTools } from "@/features/chat/tools";
import { FileMentionData } from "@/features/chat/types";
import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { getFileSource } from "@/features/search/fileSourceApi";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { isServiceError } from "@/lib/utils";
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from "@ai-sdk/openai";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { RepoIndexingStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { appendResponseMessages, extractReasoningMiddleware, LanguageModel, Message, streamText, wrapLanguageModel } from "ai";

const logger = createLogger('chat-api');

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

        const model = getModel();

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

const getModel = (): LanguageModel => {
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

            return anthropic(model);
        }
        case 'openai': {
            const openai = createOpenAI({
                apiKey: env.OPENAI_API_KEY,
            });

            return openai(model);
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
            });

            return google(model);
        }
        case 'aws-bedrock': {
            const aws = createAmazonBedrock({
                region: env.AWS_REGION,
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            });

            return aws(model);
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
