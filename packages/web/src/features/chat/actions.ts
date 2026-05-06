'use server';

import { sew } from "@/middleware/sew";
import { createAudit } from "@/ee/features/audit/audit";
import { getAnonymousId, getOrCreateAnonymousId } from "@/lib/anonymousId";
import { ErrorCode } from "@/lib/errorCodes";
import { captureEvent } from "@/lib/posthog";
import { notFound, ServiceError } from "@/lib/serviceError";
import { withAuth, withOptionalAuth } from "@/middleware/withAuth";
import { ChatVisibility, Prisma } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { SBChatMessage } from "./types";
import { generateChatNameFromMessage, getConfiguredLanguageModels, isChatSharedWithUser, isOwnerOfChat } from "./utils.server";
import { getIdentityProviderMetadata } from "@/lib/identityProviders";

export const createChat = async ({ source }: { source?: string } = {}) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
        const isGuestUser = user === undefined;

        // For anonymous users, get or create an anonymous ID to track ownership
        const anonymousCreatorId = isGuestUser ? await getOrCreateAnonymousId() : undefined;

        const chat = await prisma.chat.create({
            data: {
                orgId: org.id,
                messages: [] as unknown as Prisma.InputJsonValue,
                createdById: user?.id,
                anonymousCreatorId,
                visibility: isGuestUser ? ChatVisibility.PUBLIC : ChatVisibility.PRIVATE,
            },
        });

        // Only create audit log for authenticated users
        if (!isGuestUser) {
            await createAudit({
                action: "user.created_ask_chat",
                actor: {
                    id: user.id,
                    type: "user",
                },
                target: {
                    id: org.id.toString(),
                    type: "org",
                },
                orgId: org.id,
                metadata: { source },
            });
        }

        await captureEvent('ask_thread_created', {
            chatId: chat.id,
            isAnonymous: isGuestUser,
            source,
        });

        return {
            id: chat.id,
            isAnonymous: isGuestUser,
        }
    })
);

export const getChatInfo = async ({ chatId }: { chatId: string }) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
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
        const isSharedWithUser = await isChatSharedWithUser({ prisma, chatId, userId: user?.id });

        // Private chats can only be viewed by the owner or users it's been shared with
        if (chat.visibility === ChatVisibility.PRIVATE && !isOwner && !isSharedWithUser) {
            return notFound();
        }

        return {
            messages: chat.messages as unknown as SBChatMessage[],
            visibility: chat.visibility,
            name: chat.name,
            isOwner,
            isSharedWithUser,
        };
    })
);

export const updateChatName = async ({ chatId, name }: { chatId: string, name: string }) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
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

        // Only the owner can rename chats
        if (!isOwner) {
            return notFound();
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
    })
);

export const updateChatVisibility = async ({ chatId, visibility }: { chatId: string, visibility: ChatVisibility }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator can change visibility
        if (chat.createdById !== user.id) {
            return notFound();
        }

        await prisma.chat.update({
            where: {
                id: chatId,
                orgId: org.id,
            },
            data: {
                visibility,
            },
        });

        await createAudit({
            action: "chat.visibility_updated",
            actor: { id: user.id, type: "user" },
            target: { id: chatId, type: "chat" },
            orgId: org.id,
            metadata: { message: `Visibility changed to ${visibility}` },
        });

        return {
            success: true,
        }
    })
);

export const generateAndUpdateChatNameFromMessage = async ({ chatId, languageModelId, message }: { chatId: string, languageModelId: string, message: string }) => sew(() =>
    withOptionalAuth(async ({ prisma, user, org }) => {
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

export const deleteChat = async ({ chatId }: { chatId: string }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator of a chat can delete it.
        if (chat.createdById !== user.id) {
            return notFound();
        }

        await prisma.chat.delete({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        await createAudit({
            action: "chat.deleted",
            actor: { id: user.id, type: "user" },
            target: { id: chatId, type: "chat" },
            orgId: org.id,
        });

        return {
            success: true,
        }
    })
);

/**
 * Claims any anonymous chats created by the current user (matched via anonymousCreatorId cookie).
 * This should be called after a user signs in to transfer ownership of their anonymous chats.
 * Visibility is preserved so shared links continue to work.
 */
export const claimAnonymousChats = async () => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const anonymousId = await getAnonymousId();

        if (!anonymousId) {
            return { claimed: 0 };
        }

        const result = await prisma.chat.updateMany({
            where: {
                orgId: org.id,
                anonymousCreatorId: anonymousId,
                createdById: null,
            },
            data: {
                createdById: user.id,
                anonymousCreatorId: null,
            },
        });

        if (result.count > 0) {
            captureEvent('wa_anonymous_chats_claimed', {
                claimedCount: result.count,
            });
        }

        return { claimed: result.count };
    })
);

/**
 * Duplicates a chat with all its messages.
 * The new chat will be owned by the current user (authenticated or anonymous).
 */
export const duplicateChat = async ({ chatId, newName }: { chatId: string, newName: string }) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
        const originalChat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!originalChat) {
            return notFound();
        }

        // Check if user can access the chat (owner, shared, or public)
        const isOwner = await isOwnerOfChat(originalChat, user);
        const isSharedWithUser = await isChatSharedWithUser({ prisma, chatId, userId: user?.id });
        if (originalChat.visibility === ChatVisibility.PRIVATE && !isOwner && !isSharedWithUser) {
            return notFound();
        }

        const isGuestUser = user === undefined;
        const anonymousCreatorId = isGuestUser ? await getOrCreateAnonymousId() : undefined;

        const newChat = await prisma.chat.create({
            data: {
                orgId: org.id,
                name: newName,
                messages: originalChat.messages as unknown as Prisma.InputJsonValue,
                createdById: user?.id,
                anonymousCreatorId,
                visibility: isGuestUser ? ChatVisibility.PUBLIC : ChatVisibility.PRIVATE,
            },
        });

        return {
            id: newChat.id,
        };
    })
);

/**
 * Returns the users that have been explicitly shared access to a chat.
 */
export const getSharedWithUsersForChat = async ({ chatId }: { chatId: string }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator can view shares
        if (chat.createdById !== user.id) {
            return notFound();
        }

        const sharedWithUsers = await prisma.chatAccess.findMany({
            where: {
                chatId,
            },
            select: {
                user: true,
            },
        });

        return sharedWithUsers.map(({ user }) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
        }));
    })
);

/**
 * Shares the chat with a list of users.
 */
export const shareChatWithUsers = async ({ chatId, userIds }: { chatId: string, userIds: string[] }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator can share
        if (chat.createdById !== user.id) {
            return notFound();
        }


        const memberships = await prisma.userToOrg.findMany({
            where: {
                orgId: org.id,
                userId: {
                    in: userIds,
                },
            },
        });

        if (memberships.length !== userIds.length) {
            return notFound();
        }

        await prisma.chatAccess.createMany({
            data: userIds.map((userId) => ({
                chatId,
                userId,
            })),
            skipDuplicates: true,
        });

        await createAudit({
            action: "chat.shared_with_users",
            actor: { id: user.id, type: "user" },
            target: { id: chatId, type: "chat" },
            orgId: org.id,
            metadata: { message: userIds.join(", ") },
        });

        return { success: true };
    })
);

/**
 * Revokes access to a chat for a particular user.
 */
export const unshareChatWithUser = async ({ chatId, userId }: { chatId: string, userId: string }) => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // Only the creator can remove shares
        if (chat.createdById !== user.id) {
            return notFound();
        }

        await prisma.chatAccess.deleteMany({
            where: {
                chatId,
                userId,
            },
        });

        await createAudit({
            action: "chat.unshared_with_user",
            actor: { id: user.id, type: "user" },
            target: { id: chatId, type: "chat" },
            orgId: org.id,
            metadata: { message: userId },
        });

        return { success: true };
    })
);

export const submitFeedback = async ({
    chatId,
    messageId,
    feedbackType
}: {
    chatId: string,
    messageId: string,
    feedbackType: 'like' | 'dislike'
}) => sew(() =>
    withOptionalAuth(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        // When a chat is private, only the creator or shared users can submit feedback.
        const isSharedWithUser = await isChatSharedWithUser({ prisma, chatId, userId: user?.id });
        if (chat.visibility === ChatVisibility.PRIVATE && chat.createdById !== user?.id && !isSharedWithUser) {
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
                                userId: user?.id,
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
    })
)

export const getAskGhLoginWallData = async () => sew(async () => {
    const isEnabled = env.EXPERIMENT_ASK_GH_ENABLED === 'true';
    if (!isEnabled) {
        return { isEnabled: false as const, providers: [] };
    }

    const providers = await getIdentityProviderMetadata();
    return { isEnabled: true as const, providers };
});

