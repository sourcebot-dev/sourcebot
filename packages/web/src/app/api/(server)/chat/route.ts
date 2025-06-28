import { getRepos, sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { createSystemPrompt } from "@/features/chat/constants";
import { getTools } from "@/features/chat/tools";
import { FileMentionData } from "@/features/chat/types";
import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { getFileSource } from "@/features/search/fileSourceApi";
import { isServiceError } from "@/lib/utils";
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from "@ai-sdk/openai";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { OrgRole, RepoIndexingStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { appendResponseMessages, extractReasoningMiddleware, LanguageModel, Message, streamText, wrapLanguageModel } from "ai";
import { saveChatMessages } from "@/features/chat/actions";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
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


const chatHandler = ({ messages: chatMessages, id, selectedRepos }: { messages: Message[], id: string, selectedRepos: string[] }, domain: string) => sew(async () =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async () => {
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
                        }, domain);

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

                const repos = await getRepos(domain, {
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

            try {
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
                        await saveChatMessages({
                            chatId: id,
                            messages: appendResponseMessages({
                                messages: chatMessages,
                                responseMessages: response.messages,
                            }),
                        }, domain);
                    }
                });

                return result.toDataStreamResponse({
                    // @see: https://ai-sdk.dev/docs/troubleshooting/use-chat-an-error-occurred
                    getErrorMessage: errorHandler
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
