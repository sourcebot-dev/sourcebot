import { sew } from "@/middleware/sew";
import { getConfiguredLanguageModels, updateChatMessages, checkAskEntitlement } from "@/features/chat/utils.server";
import { generateChatNameFromMessage } from "@/ee/features/chat/llm.server";
import { getAISDKLanguageModelAndOptions } from "@/features/chat/llm.server";
import { resolveContextWindow } from "@/features/chat/modelContextWindow.server";
import { LanguageModelInfo, SBChatMessage, SearchScope } from "@/features/chat/types";
import { convertLLMOutputToPortableMarkdown, getAnswerPartFromAssistantMessage, getLanguageModelKey } from "@/features/chat/utils";
import { resolveModelCapabilities } from "@/features/chat/modelCapabilities.server";
import { describeLanguageModel, executeWithInferenceFallback, formatInferenceError, formatInferenceErrorForLog, resolveInferenceRetryConfig, withInferenceRetries } from "@/features/chat/inferenceRetry.server";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError, ServiceErrorException } from "@/lib/serviceError";
import { withOptionalAuth } from "@/middleware/withAuth";
import { ChatVisibility, Prisma } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { InferUIMessageChunk, UIDataTypes, UIMessage, UITools } from "ai";
import { captureEvent } from "@/lib/posthog";
import { createAudit } from "@/ee/features/audit/audit";
import { createMessageStream } from "@/ee/features/chat/agent";
import { getPromptCacheStrategy } from "@/ee/features/chat/promptCaching";

const logger = createLogger('ask-codebase-api');

export type AskCodebaseParams = {
    query: string;
    repos?: string[];
    languageModel?: LanguageModelInfo;
    visibility?: ChatVisibility;
    source?: string;
};

export type AskCodebaseResult = {
    answer: string;
    chatId: string;
    chatUrl: string;
    languageModel: LanguageModelInfo;
};

const blockStreamUntilFinish = async <T extends UIMessage<unknown, UIDataTypes, UITools>>(
    stream: ReadableStream<InferUIMessageChunk<T>>
) => {
    const reader = stream.getReader();
    while (true as const) {
        const { done } = await reader.read();
        if (done) break;
    }
};

export const askCodebase = (params: AskCodebaseParams): Promise<AskCodebaseResult | ServiceError> =>
    sew(() =>
        withOptionalAuth(async ({ org, user, prisma }) => {
            // Ask Sourcebot is a paid feature. askCodebase() is the single choke point
            // for the programmatic ask path (the MCP `ask_codebase` tool and the
            // /api/chat/blocking route both wrap it), so gating here covers both without
            // double-gating at the tool-registration layer.
            const askEntitlementError = await checkAskEntitlement();
            if (askEntitlementError) {
                return askEntitlementError;
            }

            const { query, repos = [], languageModel: requestedLanguageModel, visibility: requestedVisibility, source } = params;

            const configuredModels = await getConfiguredLanguageModels();
            if (configuredModels.length === 0) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "No language models are configured. Please configure at least one language model. See: https://docs.sourcebot.dev/docs/configuration/language-model-providers",
                } satisfies ServiceError;
            }

            let languageModelConfig = configuredModels[0];
            if (requestedLanguageModel) {
                const matchingModel = configuredModels.find(
                    (m) => getLanguageModelKey(m) === getLanguageModelKey(requestedLanguageModel)
                );
                if (!matchingModel) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: `Language model '${requestedLanguageModel.provider}/${requestedLanguageModel.model}' is not configured.`,
                    } satisfies ServiceError;
                }
                languageModelConfig = matchingModel;
            }

            const chatVisibility = (requestedVisibility && user)
                ? requestedVisibility
                : (user ? ChatVisibility.PRIVATE : ChatVisibility.PUBLIC);

            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    createdById: user?.id,
                    visibility: chatVisibility,
                    messages: [] as unknown as Prisma.InputJsonValue,
                },
            });

            await captureEvent('ask_thread_created', {
                chatId: chat.id,
                isAnonymous: !user,
                source,
            });

            if (user) {
                await createAudit({
                    action: 'user.created_ask_chat',
                    actor: { id: user.id, type: 'user' },
                    target: { id: org.id.toString(), type: 'org' },
                    orgId: org.id,
                    metadata: { source },
                });
            }

            logger.debug(`Starting blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
                query: query.substring(0, 100),
                model: describeLanguageModel(languageModelConfig),
            });

            const userMessage: SBChatMessage = {
                id: randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text: query }],
            };

            const selectedRepos = (await Promise.all(repos.map(async (repo) => {
                const repoDB = await prisma.repo.findFirst({
                    where: {
                        name: repo,
                        orgId: org.id,
                    },
                });
                if (!repoDB) {
                    throw new ServiceErrorException({
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: `Repository '${repo}' not found.`,
                    });
                }
                return {
                    type: 'repo',
                    value: repoDB.name,
                    name: repoDB.displayName ?? repoDB.name.split('/').pop() ?? repoDB.name,
                    codeHostType: repoDB.external_codeHostType,
                } satisfies SearchScope;
            })));

            await captureEvent('ask_message_sent', {
                chatId: chat.id,
                messageCount: 1,
                selectedReposCount: selectedRepos.length,
                source,
                modelProvider: languageModelConfig.provider,
                model: languageModelConfig.model,
                hasAskMcpServersAvailable: false,
                askMcpConnectedServerCount: 0,
                askMcpEnabledServerCount: 0,
                askMcpDisabledServerCount: 0,
                ...(env.EXPERIMENT_ASK_GH_ENABLED === 'true' ? {
                    selectedRepos: selectedRepos.map(r => r.value)
                } : {}),
            });

            // Inference runs through the shared retry/fallback executor: the
            // primary model is retried on transient failures, then the models
            // listed in its `fallbackModels` config are tried in order. Only
            // inference failures fall back; deterministic request errors (bad
            // repo names, entitlement errors, ...) are rethrown immediately.
            // Chat-name generation runs concurrently and is best-effort: a
            // naming failure must not fail the whole answer.
            const primaryRetryConfig = resolveInferenceRetryConfig(languageModelConfig);
            const [agentOutcome, chatNameOutcome] = await Promise.allSettled([
                executeWithInferenceFallback({
                    primaryModel: languageModelConfig,
                    allModels: configuredModels,
                    run: async (candidate) => {
                        const { model, providerOptions, temperature } = await getAISDKLanguageModelAndOptions(candidate);
                        const modelName = candidate.displayName ?? candidate.model;
                        const contextWindow = await resolveContextWindow(candidate);
                        const { inputModalities, supportedDocumentTypes } = await resolveModelCapabilities(candidate);

                        // No-op for non-Anthropic providers / when caching is disabled.
                        const promptCacheStrategy = getPromptCacheStrategy(
                            candidate.provider,
                            env.SOURCEBOT_CHAT_PROMPT_CACHING_ENABLED === 'true',
                        );

                        // The UI-message stream reports failures through `onError`,
                        // which by contract returns a message string. Capture the
                        // raw error and rethrow it after draining so the
                        // retry/fallback loop can classify it (mapping it here
                        // would discard the provider status code and retryability).
                        let streamError: unknown;
                        let attemptMessages: SBChatMessage[] = [];

                        const stream = await createMessageStream({
                            chatId: chat.id,
                            messages: [userMessage],
                            metadata: {
                                selectedSearchScopes: selectedRepos,
                            },
                            selectedRepos: selectedRepos.map(r => r.value),
                            prisma,
                            model,
                            modelName,
                            contextWindow,
                            promptCacheStrategy,
                            modelProviderOptions: providerOptions,
                            modelTemperature: temperature,
                            // Retries are handled by the loop around `run`
                            // (uniform backoff + fallback); disable the SDK's
                            // built-in retries to avoid compounding them.
                            modelMaxRetries: 0,
                            onFinish: async ({ messages }) => {
                                attemptMessages = messages;
                            },
                            onError: (error) => {
                                streamError = error;
                                return formatInferenceError(error, candidate);
                            },
                        });

                        await blockStreamUntilFinish(stream);
                        if (streamError !== undefined) {
                            throw streamError;
                        }

                        return { messages: attemptMessages, inputModalities, supportedDocumentTypes };
                    },
                }),
                withInferenceRetries(
                    () => generateChatNameFromMessage({
                        message: query,
                        languageModelConfig,
                        // Retries are handled by the wrapper (uniform backoff);
                        // disable the SDK's built-in retries to avoid compounding.
                        maxRetries: 0,
                    }),
                    primaryRetryConfig,
                    languageModelConfig,
                ),
            ]);

            if (agentOutcome.status === 'rejected') {
                throw agentOutcome.reason;
            }

            const { modelConfig: servedModelConfig, result: agentResult } = agentOutcome.value;
            const finalMessages = agentResult.messages;

            let name: string;
            if (chatNameOutcome.status === 'fulfilled' && chatNameOutcome.value) {
                name = chatNameOutcome.value;
            } else {
                logger.warn(`Failed to generate a chat name for chat ${chat.id}. Using the query as the name. Details: ${chatNameOutcome.status === 'rejected' ? formatInferenceErrorForLog(chatNameOutcome.reason, languageModelConfig) : 'empty response'}`);
                name = query.substring(0, 50);
            }

            await updateChatMessages({ chatId: chat.id, messages: finalMessages, prisma });

            await prisma.chat.update({
                where: { id: chat.id, orgId: org.id },
                data: { name },
            });

            const assistantMessage = finalMessages.find(m => m.role === 'assistant');
            const answerPart = assistantMessage
                ? getAnswerPartFromAssistantMessage(assistantMessage, false)
                : undefined;
            const answerText = answerPart?.text ?? '';

            const fileSources = finalMessages.flatMap((message) =>
                message.parts
                    .filter((part) => part.type === 'data-source')
                    .map((part) => part.data)
                    .filter((source) => source.type === 'file')
            );

            const baseUrl = env.AUTH_URL;
            const portableAnswer = convertLLMOutputToPortableMarkdown(answerText, baseUrl, fileSources);
            const chatUrl = `${baseUrl}/chat/${chat.id}`;

            logger.debug(`Completed blocking agent for chat ${chat.id}`, {
                chatId: chat.id,
                model: describeLanguageModel(servedModelConfig),
                usedFallback: servedModelConfig !== languageModelConfig,
            });

            return {
                answer: portableAnswer,
                chatId: chat.id,
                chatUrl,
                languageModel: {
                    provider: servedModelConfig.provider,
                    model: servedModelConfig.model,
                    displayName: servedModelConfig.displayName,
                    inputModalities: agentResult.inputModalities,
                    supportedDocumentTypes: agentResult.supportedDocumentTypes,
                },
            } satisfies AskCodebaseResult;
        })
    );
