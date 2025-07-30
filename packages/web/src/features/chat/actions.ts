'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { chatIsReadonly, notFound, ServiceError } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { ChatVisibility, OrgRole, Prisma } from "@sourcebot/db";
import fs from 'fs';
import path from 'path';
import { LanguageModelInfo, SBChatMessage } from "./types";
import { loadConfig } from "@sourcebot/shared";
import { LanguageModel } from "@sourcebot/schemas/v3/languageModel.type";
import { SOURCEBOT_GUEST_USER_ID } from "@/lib/constants";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

export const createChat = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {

            const isGuestUser = userId === SOURCEBOT_GUEST_USER_ID;

            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    messages: [] as unknown as Prisma.InputJsonValue,
                    createdById: userId,
                    visibility: isGuestUser ? ChatVisibility.PUBLIC : ChatVisibility.PRIVATE,
                },
            });

            return {
                id: chat.id,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const getChatInfo = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            return {
                messages: chat.messages as unknown as SBChatMessage[],
                visibility: chat.visibility,
                name: chat.name,
                isReadonly: chat.isReadonly,
            };
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const updateChatMessages = async ({ chatId, messages }: { chatId: string, messages: SBChatMessage[] }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            if (chat.isReadonly) {
                return chatIsReadonly();
            }

            await prisma.chat.update({
                where: {
                    id: chatId,
                },
                data: {
                    messages: messages as unknown as Prisma.InputJsonValue,
                },
            });

            if (env.DEBUG_WRITE_CHAT_MESSAGES_TO_FILE) {
                const chatDir = path.join(env.DATA_CACHE_DIR, 'chats');
                if (!fs.existsSync(chatDir)) {
                    fs.mkdirSync(chatDir, { recursive: true });
                }

                const chatFile = path.join(chatDir, `${chatId}.json`);
                fs.writeFileSync(chatFile, JSON.stringify(messages, null, 2));
            }

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const getUserChatHistory = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chats = await prisma.chat.findMany({
                where: {
                    orgId: org.id,
                    createdById: userId,
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            });

            return chats.map((chat) => ({
                id: chat.id,
                createdAt: chat.createdAt,
                name: chat.name,
                visibility: chat.visibility,
            }))
        })
    )
);

export const updateChatName = async ({ chatId, name }: { chatId: string, name: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            if (chat.isReadonly) {
                return chatIsReadonly();
            }

            await prisma.chat.update({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
                data: {
                    name,
                },
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const deleteChat = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            // Public chats cannot be deleted.
            if (chat.visibility === ChatVisibility.PUBLIC) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: 'You are not allowed to delete this chat.',
                } satisfies ServiceError;
            }

            // Only the creator of a chat can delete it.
            if (chat.createdById !== userId) {
                return notFound();
            }

            await prisma.chat.delete({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            return {
                success: true,
            }
        })
    )
);

export const submitFeedback = async ({
    chatId,
    messageId,
    feedbackType
}: {
    chatId: string,
    messageId: string,
    feedbackType: 'like' | 'dislike'
}, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                },
            });

            if (!chat) {
                return notFound();
            }

            // When a chat is private, only the creator can submit feedback.
            if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== userId) {
                return notFound();
            }

            const messages = chat.messages as unknown as SBChatMessage[];
            const updatedMessages = messages.map(message => {
                if (message.id === messageId && message.role === 'assistant') {
                    return {
                        ...message,
                        metadata: {
                            ...message.metadata,
                            feedback: [
                                ...(message.metadata?.feedback ?? []),
                                {
                                    type: feedbackType,
                                    timestamp: new Date().toISOString(),
                                    userId: userId,
                                }
                            ]
                        }
                    } satisfies SBChatMessage;
                }
                return message;
            });

            await prisma.chat.update({
                where: { id: chatId },
                data: {
                    messages: updatedMessages as unknown as Prisma.InputJsonValue,
                },
            });

            return { success: true };
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

/**
 * Returns the subset of information about the configured language models
 * that we can safely send to the client.
 */
export const getConfiguredLanguageModelsInfo = async (): Promise<LanguageModelInfo[]> => {
    const models = await _getConfiguredLanguageModelsFull();
    return models.map((model): LanguageModelInfo => ({
        provider: model.provider,
        model: model.model,
        displayName: model.displayName,
    }));
}

/**
 * Returns the full configuration of the language models.
 * 
 * @warning Do NOT call this function from the client,
 * or pass the result of calling this function to the client.
 */
export const _getConfiguredLanguageModelsFull = async (): Promise<LanguageModel[]> => {
    if (!env.CONFIG_PATH) {
        return [];
    }

    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return config.models ?? [];
    } catch (error) {
        console.error(`Failed to load config file ${env.CONFIG_PATH}: ${error}`);
        return [];
    }
}
