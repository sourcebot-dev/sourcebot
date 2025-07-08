import { getRepos, sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { saveChatMessages, updateChatName } from "@/features/chat/actions";
import { createSystemPrompt } from "@/features/chat/constants";
import { answerTool, createCodeSearchTool, findSymbolDefinitionsTool, findSymbolReferencesTool, readFilesTool, toolNames } from "@/features/chat/tools";
import { SBChatMessage, SBChatMessageMetadata } from "@/features/chat/types";
import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { getFileSource } from "@/features/search/fileSourceApi";
import { ErrorCode } from "@/lib/errorCodes";
import { schemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModelV2 } from "@ai-sdk/provider";
import { OrgRole, RepoIndexingStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, hasToolCall, JSONValue, stepCountIs, streamText } from "ai";
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


const chatHandler = ({ messages, id, selectedRepos }: { messages: SBChatMessage[], id: string, selectedRepos: string[] }, domain: string) => sew(async () =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async () => {
            // @todo: do we want to only include mentions from the latest message?
            const mentions = messages.flatMap((message) => message.metadata?.mentions ?? []);

            // @todo: we can probably cache files per chat session.
            // That way we don't have to refetch files for every message.
            const files = mentions.length > 0 ?
                (await Promise.all(
                    mentions
                        .filter((mention) => mention.type === 'file')
                        .map(async (data) => {
                            const { path, repo, revision } = data;

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

            const { model, providerOptions, headers } = getModel();
            const systemPrompt = createSystemPrompt({
                files,
                repos: reposAccessibleToLLM,
            });

            if (
                messages.length === 1 &&
                messages[0].role === "user" &&
                messages[0].parts.length >= 1 &&
                messages[0].parts[0].type === 'text'
            ) {
                const content = messages[0].parts[0].text;
                // non-blocking
                generateChatTitle(content, model).then((title) => {
                    if (title) {
                        updateChatName({
                            chatId: id,
                            name: title,
                        }, domain);
                    }
                })
            }

            const startTime = new Date();

            try {
                const stream = createUIMessageStream<SBChatMessage>({
                    execute: async ({ writer }) => {
                        writer.write({
                            type: 'start',
                        });

                        const stream = streamText({
                            model,
                            providerOptions,
                            headers,
                            system: systemPrompt,
                            messages: convertToModelMessages(messages),
                            tools: {
                                [toolNames.searchCode]: createCodeSearchTool(selectedRepos),
                                [toolNames.readFiles]: readFilesTool,
                                [toolNames.findSymbolReferences]: findSymbolReferencesTool,
                                [toolNames.findSymbolDefinitions]: findSymbolDefinitionsTool,
                                [toolNames.answerTool]: answerTool,
                            },
                            temperature: env.SOURCEBOT_CHAT_MODEL_TEMPERATURE,
                            stopWhen: [
                                hasToolCall(toolNames.answerTool)
                            ],
                            maxOutputTokens: env.SOURCEBOT_CHAT_MAX_OUTPUT_TOKENS, // Increased for tool results and responses
                            toolChoice: "auto", // Let the model decide when to use tools
                        });

                        await new Promise<void>((resolve) => writer.merge(stream.toUIMessageStream({
                            sendReasoning: true,
                            sendStart: false,
                            sendFinish: false,
                            messageMetadata: ({ part }): SBChatMessageMetadata | undefined => {
                                if (part.type === 'tool-call' && part.toolName === toolNames.answerTool) {
                                    return {
                                        researchDuration: new Date().getTime() - startTime.getTime(),
                                    };
                                }

                                if (part.type === 'finish') {
                                    return {
                                        totalUsage: {
                                            inputTokens: part.totalUsage.inputTokens,
                                            outputTokens: part.totalUsage.outputTokens,
                                            totalTokens: part.totalUsage.totalTokens,
                                            reasoningTokens: part.totalUsage.reasoningTokens,
                                            cachedInputTokens: part.totalUsage.cachedInputTokens,
                                        },
                                    }
                                }
                            },
                            onFinish: async () => {
                                resolve();
                            }
                        })));

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
                providerOptions: {
                    anthropic: {
                        thinking: {
                            type: "enabled",
                            budgetTokens: env.ANTHROPIC_THINKING_BUDGET_TOKENS,
                        }
                    } satisfies AnthropicProviderOptions,
                },
                // headers: {
                //     // @see: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#interleaved-thinking
                //     'anthropic-beta': 'interleaved-thinking-2025-05-14',
                // },
            };
        }
        case 'openai': {
            const openai = createOpenAI({
                apiKey: env.OPENAI_API_KEY,
            });

            return {
                model: openai(model),
            };
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
            });

            return {
                model: google(model),
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

