import { sew } from "@/middleware/sew";
import { createMessageStream } from "@/features/chat/agent";
import { additionalChatRequestParamsSchema } from "@/features/chat/types";
import { getLanguageModelKey } from "@/features/chat/utils";
import { getAISDKLanguageModelAndOptions, getConfiguredLanguageModels, isOwnerOfChat, updateChatMessages } from "@/features/chat/utils.server";
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

    const { messages, id, selectedSearchScopes, languageModel: _languageModel } = parsed.data;
    // @note: a bit of type massaging is required here since the
    // zod schema does not enum on `model` or `provider`.
    // @see: chat/types.ts
    const languageModel = _languageModel;

    const response = await sew(() =>
        withOptionalAuth(async ({ org, user, prisma }) => {
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

            const { model, providerOptions, temperature } = await getAISDKLanguageModelAndOptions(languageModelConfig);

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

            await captureEvent('ask_message_sent', {
                chatId: id,
                messageCount: messages.length,
                selectedReposCount: expandedRepos.length,
                source,
                ...(env.EXPERIMENT_ASK_GH_ENABLED === 'true' ? { selectedRepos: expandedRepos } : {}),
            });

            const stream = await createMessageStream({
                chatId: id,
                messages,
                metadata: {
                    selectedSearchScopes,
                },
                selectedRepos: expandedRepos,
                model,
                modelName: languageModelConfig.displayName ?? languageModelConfig.model,
                modelProviderOptions: providerOptions,
                modelTemperature: temperature,
                distinctId: user?.id,
                onFinish: async ({ messages }) => {
                    await updateChatMessages({ chatId: id, messages, prisma });
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
