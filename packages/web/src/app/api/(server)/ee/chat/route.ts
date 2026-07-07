import { sew } from "@/middleware/sew";
import { getAskMcpAvailabilityAnalytics, getAskMcpTurnCompletedAnalytics } from "@/ee/features/chat/askMcpAnalytics.server";
import { createMessageStream } from "@/ee/features/chat/agent";
import { getPromptCacheStrategy } from "@/ee/features/chat/promptCaching";
import { additionalChatRequestParamsSchema } from "@/features/chat/types";
import { getLanguageModelKey, getMessageTextBytes, getUserMessageAttachments } from "@/features/chat/utils";
import { ATTACHMENT_MAX_TURN_TEXT_BYTES } from "@/features/chat/constants";
import { isMediaTypeAccepted, mediaTypeToModality } from "@/features/chat/attachments/modality";
import { resolveModelCapabilities } from "@/features/chat/modelCapabilities.server";
import { checkAskEntitlement, commitMessageAttachments, getConfiguredLanguageModels, isOwnerOfChat, updateChatMessages } from "@/features/chat/utils.server";
import { getAISDKLanguageModelAndOptions } from "@/features/chat/llm.server";
import { resolveContextWindow } from "@/features/chat/modelContextWindow.server";
import { materializeCommandMessageTexts } from "@/ee/features/chat/skills/commandResolution";
import { getAskSkillAvailabilityAnalytics, getAskSkillTurnCompletedAnalytics } from "@/ee/features/chat/skills/skillAnalytics.server";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { captureEvent } from "@/lib/posthog";
import { notFound, requestBodySchemaValidationError, ServiceError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withOptionalAuth } from "@/middleware/withAuth";
import * as Sentry from "@sentry/nextjs";
import { createLogger, env } from "@sourcebot/shared";
import {
    createUIMessageStreamResponse
} from "ai";
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

    const { messages, id, selectedSearchScopes, disabledMcpServerIds, languageModel: _languageModel } = parsed.data;
    // @note: a bit of type massaging is required here since the
    // zod schema does not enum on `model` or `provider`.
    // @see: chat/types.ts
    const languageModel = _languageModel;

    const response = await sew(() =>
        withOptionalAuth(async ({ org, user, prisma }) => {
            // Gate the generative path behind the `ask` entitlement. The client
            // also gates this, but server-side enforcement can't be bypassed.
            const askError = await checkAskEntitlement();
            if (askError) {
                return askError;
            }

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
            const isOwner = await isOwnerOfChat(chat, user);
            if (!isOwner) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: 'Only the owner of a chat can send messages.',
                } satisfies ServiceError;
            }

            const latestMessage = messages[messages.length - 1];

            // `z.array(z.any())` permits an empty array; reject it before
            // anything downstream dereferences the latest message.
            if (!latestMessage) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: 'At least one message is required.',
                } satisfies ServiceError;
            }

            // Authoritatively enforce the per-turn inline-text budget (the client
            // gate can't be trusted), keeping oversized text out of the prompt and
            // the persisted messages. Only the user turn carries submitted text.
            if (
                latestMessage.role === 'user' &&
                getMessageTextBytes(latestMessage) > ATTACHMENT_MAX_TURN_TEXT_BYTES
            ) {
                return {
                    statusCode: StatusCodes.REQUEST_TOO_LONG,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Message and attachments exceed the ${Math.round(ATTACHMENT_MAX_TURN_TEXT_BYTES / 1024)}KB per-message limit.`,
                } satisfies ServiceError;
            }

            // From the language model ID, attempt to find the
            // corresponding config in `config.json`.
            const languageModelConfig =
                (await getConfiguredLanguageModels())
                    .find((model) => getLanguageModelKey(model) === getLanguageModelKey(languageModel));

            if (!languageModelConfig) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Language model ${languageModel.model} is not configured.`,
                } satisfies ServiceError;
            }

            // Verify and commit any binary attachments referenced by the latest
            // message (links them to this chat, flips PENDING -> COMMITTED).
            // Rejects forged/unauthorized attachment ids before the agent runs.
            // Done after model validation so a rejected model can't leave
            // attachments committed without a persisted message.
            const attachmentError = await commitMessageAttachments({
                prisma,
                chatId: id,
                orgId: org.id,
                userId: user?.id,
                message: latestMessage,
            });
            if (attachmentError) {
                return attachmentError;
            }

            const { model, providerOptions, temperature } = await getAISDKLanguageModelAndOptions(languageModelConfig);

            // Authoritative, server-side resolution of the model's input
            // modalities. The agent's multimodal content builder and degrade
            // logic rely on this value, never the client.
            const acceptedModalities = (await resolveModelCapabilities(languageModelConfig)).inputModalities;

            // If the latest message carries native-media attachments the selected
            // model cannot accept, the agent will degrade (omit the bytes). Record it.
            const droppedAttachmentCount = getUserMessageAttachments(latestMessage).filter(
                (attachment) =>
                    attachment.kind === 'blob' &&
                    mediaTypeToModality(attachment.mediaType) !== undefined &&
                    !isMediaTypeAccepted(attachment.mediaType, acceptedModalities),
            ).length;
            if (droppedAttachmentCount > 0) {
                await captureEvent('chat_attachment_degraded', {
                    chatId: id,
                    source: req.headers.get('X-Sourcebot-Client-Source') ?? 'unknown',
                    droppedImageCount: droppedAttachmentCount,
                    modelProvider: languageModelConfig.provider,
                    model: languageModelConfig.model,
                });
            }

            // Total context window for the selected model, used as the
            // denominator for the UI's context-usage gauge. Undefined when
            // unknown (e.g. self-hosted models).
            const contextWindow = await resolveContextWindow(languageModelConfig);

            // No-op for non-Anthropic providers / when caching is disabled, so
            // it never perturbs other providers' requests.
            const promptCacheStrategy = getPromptCacheStrategy(
                languageModelConfig.provider,
                env.SOURCEBOT_CHAT_PROMPT_CACHING_ENABLED === 'true',
            );

            const expandedRepos = (await Promise.all(selectedSearchScopes.map(async (scope) => {
                if (scope.type === 'repo') return [scope.value];
                if (scope.type === 'reposet') {
                    const reposet = await prisma.searchContext.findFirst({
                        where: { orgId: org.id, name: scope.value },
                        include: { repos: true }
                    });
                    return reposet ? reposet.repos.map(r => r.name) : [];
                }
                return [];
            }))).flat();

            const source = req.headers.get('X-Sourcebot-Client-Source') ?? undefined;
            const askMcpSource = source === 'sourcebot-web-client' ? source : undefined;
            const [askMcpAvailability, askSkillAvailability] = await Promise.all([
                getAskMcpAvailabilityAnalytics({
                    prisma,
                    userId: user?.id,
                    orgId: org.id,
                    disabledMcpServerIds,
                }),
                getAskSkillAvailabilityAnalytics({
                    prisma,
                    userId: user?.id,
                    orgId: org.id,
                }),
            ]);

            await captureEvent('ask_message_sent', {
                chatId: id,
                messageCount: messages.length,
                selectedReposCount: expandedRepos.length,
                source,
                modelProvider: languageModelConfig.provider,
                model: languageModelConfig.model,
                ...askMcpAvailability,
                ...(env.EXPERIMENT_ASK_GH_ENABLED === 'true' ? { selectedRepos: expandedRepos } : {}),
            });

            const messagesWithMaterializedCommands = await materializeCommandMessageTexts({
                messages,
                prisma,
                userId: user?.id,
                orgId: org.id,
                requestSource: source,
            });

            const stream = await createMessageStream({
                chatId: id,
                messages: messagesWithMaterializedCommands,
                metadata: {
                    selectedSearchScopes,
                },
                selectedRepos: expandedRepos,
                prisma,
                disabledMcpServerIds,
                model,
                modelName: languageModelConfig.displayName ?? languageModelConfig.model,
                contextWindow,
                promptCacheStrategy,
                modelProviderOptions: providerOptions,
                modelTemperature: temperature,
                userId: user?.id,
                orgId: org.id,
                acceptedModalities,
                onFinish: async ({ messages }) => {
                    await updateChatMessages({ chatId: id, messages, prisma });
                    const askMcpTurnCompleted = getAskMcpTurnCompletedAnalytics({
                        messages,
                        availability: askMcpAvailability,
                    });
                    if (askMcpTurnCompleted) {
                        void captureEvent('ask_mcp_turn_completed', {
                            chatId: id,
                            source: askMcpSource,
                            ...askMcpTurnCompleted,
                        });
                    }
                    const askSkillTurnCompleted = getAskSkillTurnCompletedAnalytics({
                        messages,
                        availability: askSkillAvailability,
                    });
                    if (askSkillTurnCompleted) {
                        void captureEvent('ask_skill_turn_completed', {
                            chatId: id,
                            source: askMcpSource,
                            ...askSkillTurnCompleted,
                        });
                    }
                },
                onError: (error: unknown) => {
                    logger.error(error);
                    Sentry.captureException(error);

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
