'use server';

import { sew } from "@/middleware/sew";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { withOptionalAuth } from "@/middleware/withAuth";
import { StatusCodes } from "http-status-codes";
import { checkAskEntitlement, getConfiguredLanguageModels, isOwnerOfChat } from "@/features/chat/utils.server";
import { generateChatNameFromMessage } from "./llm.server";

export const generateAndUpdateChatNameFromMessage = async ({ chatId, languageModelId, message }: { chatId: string, languageModelId: string, message: string }) => sew(() =>
    withOptionalAuth(async ({ prisma, user, org }) => {
        const askError = await checkAskEntitlement();
        if (askError) {
            return askError;
        }

        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        const isOwner = await isOwnerOfChat(chat, user);
        if (!isOwner) {
            return notFound();
        }

        const languageModelConfig =
            (await getConfiguredLanguageModels())
                .find((model) => model.model === languageModelId);

        if (!languageModelConfig) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Language model ${languageModelId} is not configured.`,
            } satisfies ServiceError;
        }

        const name = await generateChatNameFromMessage({ message, languageModelConfig });

        await prisma.chat.update({
            where: {
                id: chatId,
                orgId: org.id,
            },
            data: {
                name: name,
            },
        })

        return {
            success: true,
        }
    })
)
