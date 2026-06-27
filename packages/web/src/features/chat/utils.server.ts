import 'server-only';

import { getAnonymousId } from '@/lib/anonymousId';
import { AttachmentStatus, Chat, ChatVisibility, Prisma, PrismaClient, User } from '@sourcebot/db';
import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { env, loadConfig } from '@sourcebot/shared';
import fs from 'fs';
import path from 'path';
import { BlobAttachment, LanguageModelInfo, SBChatMessage } from './types';
import { getUserMessageAttachments } from './utils';
import { getStorageBackend } from './attachments/storage';
import { resolveModelCapabilities } from './modelCapabilities.server';
import { hasEntitlement } from '@/lib/entitlements';
import { ServiceError } from '@/lib/serviceError';
import { ErrorCode } from '@/lib/errorCodes';
import { StatusCodes } from 'http-status-codes';

/**
 * Returns a FORBIDDEN ServiceError when the deployment lacks the `ask`
 * entitlement, or null when Ask is available. Gates the generative chat
 * surfaces (message streaming, chat creation, sharing) server-side so the
 * client gate can't be bypassed.
 */
export const checkAskEntitlement = async (): Promise<ServiceError | null> => {
    if (await hasEntitlement('ask')) {
        return null;
    }
    return {
        statusCode: StatusCodes.FORBIDDEN,
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: "Ask Sourcebot is not available in your current plan",
    } satisfies ServiceError;
};

/**
 * Checks if the current user (authenticated or anonymous) is the owner of a chat.
 */
export const isOwnerOfChat = async (chat: Chat, user: User | undefined): Promise<boolean> => {
    // Authenticated user owns the chat
    if (user && chat.createdById === user.id) {
        return true;
    }

    // Only check the anonymous cookie for unclaimed chats (createdById === null).
    // Once a chat has been claimed by an authenticated user, the anonymous path
    // must not grant access — even if the same browser still holds the original cookie.
    if (!chat.createdById && chat.anonymousCreatorId) {
        const anonymousId = await getAnonymousId();
        if (anonymousId && chat.anonymousCreatorId === anonymousId) {
            return true;
        }
    }

    return false;
};

/**
 * Checks if a user has been explicitly shared access to a chat.
 */
export const isChatSharedWithUser = async ({
    prisma, chatId, userId,
}: {
    prisma: PrismaClient;
    chatId: string;
    userId?: string;
}): Promise<boolean> => {
    if (!userId) {
        return false;
    }

    const share = await prisma.chatAccess.findUnique({
        where: {
            chatId_userId: {
                chatId,
                userId,
            },
        },
    });

    return share !== null;
};

/**
 * Resolves a (possibly anonymous) user's access to a chat. This is the single
 * source of truth for the "can view this chat" rule, shared by `getChatInfo`
 * and the attachment serving route so the two cannot drift: a PUBLIC chat is
 * viewable by anyone in the org; a PRIVATE chat only by its owner or users it
 * has been explicitly shared with.
 */
export const resolveChatAccess = async ({
    prisma, chat, user,
}: {
    prisma: PrismaClient;
    chat: Chat;
    user: User | undefined;
}): Promise<{ isOwner: boolean; isSharedWithUser: boolean; canView: boolean }> => {
    const isOwner = await isOwnerOfChat(chat, user);
    const isSharedWithUser = await isChatSharedWithUser({ prisma, chatId: chat.id, userId: user?.id });
    const canView = chat.visibility !== ChatVisibility.PRIVATE || isOwner || isSharedWithUser;
    return { isOwner, isSharedWithUser, canView };
};

/**
 * Verifies and commits the binary (blob) attachments referenced by the latest
 * user message, then links them to the chat. Each referenced `attachmentId`
 * must exist in this org, have been uploaded by this user, and still be
 * `PENDING` (never trust client ids). Already-linked ids are treated as a
 * no-op so re-sends / approval continuations are idempotent. On success the
 * blobs are linked via `ChatAttachment` and flipped to `COMMITTED`.
 *
 * Returns a `ServiceError` to reject the request, or `null` when there is
 * nothing to commit / the commit succeeded.
 */
export const commitMessageAttachments = async ({
    prisma, chatId, orgId, userId, message,
}: {
    prisma: PrismaClient;
    chatId: string;
    orgId: number;
    userId: string | undefined;
    message: Pick<SBChatMessage, 'parts'> | undefined;
}): Promise<ServiceError | null> => {
    if (!message) {
        return null;
    }

    const blobRefs = getUserMessageAttachments(message)
        .filter((attachment): attachment is BlobAttachment => attachment.kind === 'blob');

    if (blobRefs.length === 0) {
        return null;
    }

    // Anonymous users cannot upload binary attachments, so a blob ref from an
    // unauthenticated request can only be a forged/replayed id.
    if (!userId) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: 'Anonymous users cannot attach files.',
        } satisfies ServiceError;
    }

    const ids = [...new Set(blobRefs.map((ref) => ref.attachmentId))];

    const [attachments, existingLinks] = await Promise.all([
        prisma.attachment.findMany({ where: { id: { in: ids }, orgId } }),
        prisma.chatAttachment.findMany({ where: { chatId, attachmentId: { in: ids } } }),
    ]);

    const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
    const alreadyLinkedIds = new Set(existingLinks.map((link) => link.attachmentId));

    const idsToCommit: string[] = [];
    for (const id of ids) {
        // Already linked to this chat (idempotent re-send): nothing to do.
        if (alreadyLinkedIds.has(id)) {
            continue;
        }

        const attachment = attachmentById.get(id);
        if (
            !attachment ||
            attachment.uploadedById !== userId ||
            attachment.status !== AttachmentStatus.PENDING
        ) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: 'Invalid or unauthorized attachment reference.',
            } satisfies ServiceError;
        }
        idsToCommit.push(id);
    }

    if (idsToCommit.length > 0) {
        await prisma.$transaction([
            prisma.chatAttachment.createMany({
                data: idsToCommit.map((attachmentId) => ({ chatId, attachmentId })),
                skipDuplicates: true,
            }),
            prisma.attachment.updateMany({
                where: { id: { in: idsToCommit } },
                data: { status: AttachmentStatus.COMMITTED },
            }),
        ]);
    }

    return null;
};

/**
 * Deletes any of the given attachments that no longer have a `ChatAttachment`
 * link (and their stored bytes). Bytes are never removed by DB cascade, so this
 * is the refcount-aware byte sweep invoked after a chat (and its links) is
 * deleted. Best-effort on the storage layer: a missing/failed byte delete does
 * not block removing the DB row.
 */
export const deleteOrphanedAttachments = async ({
    prisma, attachmentIds,
}: {
    prisma: PrismaClient;
    attachmentIds: string[];
}): Promise<void> => {
    if (attachmentIds.length === 0) {
        return;
    }

    const remainingLinks = await prisma.chatAttachment.findMany({
        where: { attachmentId: { in: attachmentIds } },
        select: { attachmentId: true },
    });
    const stillLinked = new Set(remainingLinks.map((link) => link.attachmentId));
    const orphanedIds = attachmentIds.filter((id) => !stillLinked.has(id));

    if (orphanedIds.length === 0) {
        return;
    }

    const orphans = await prisma.attachment.findMany({
        where: { id: { in: orphanedIds } },
        select: { id: true, storageKey: true },
    });

    const storage = getStorageBackend();
    await Promise.all(orphans.map((orphan) =>
        storage.delete(orphan.storageKey).catch(() => { /* best effort */ })));

    await prisma.attachment.deleteMany({ where: { id: { in: orphanedIds } } });
};

export const updateChatMessages = async ({
    prisma, chatId, messages,
}: {
    prisma: PrismaClient;
    chatId: string;
    messages: SBChatMessage[];
}) => {
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
};

/**
 * Returns the full configuration of the language models.
 *
 * @warning this can contain sensitive information like environment
 * variable names and base URLs. When passing information to the client,
 * use getConfiguredLanguageModelsInfo instead.
 */
export const getConfiguredLanguageModels = async (): Promise<LanguageModel[]> => {
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return config.models ?? [];
    } catch (error) {
        console.error('Failed to load language model configuration', error);
        return [];
    }
};

/**
 * Returns the subset of information about the configured language models
 * that we can safely send to the client.
 */
export const getConfiguredLanguageModelsInfo = async () => {
    const models = await getConfiguredLanguageModels();
    return Promise.all(models.map(async (model): Promise<LanguageModelInfo> => {
        const { inputModalities, supportedDocumentTypes } = await resolveModelCapabilities(model);
        return {
            provider: model.provider,
            model: model.model,
            displayName: model.displayName,
            inputModalities,
            supportedDocumentTypes,
        };
    }));
};
