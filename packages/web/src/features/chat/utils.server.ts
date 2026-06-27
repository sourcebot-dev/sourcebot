import 'server-only';

import { getAnonymousId } from '@/lib/anonymousId';
import { Chat, Prisma, PrismaClient, User } from '@sourcebot/db';
import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { createLogger, env, loadConfig } from '@sourcebot/shared';
import fs from 'fs';
import path from 'path';
import { LanguageModelInfo, SBChatMessage } from './types';
import { resolveModelCapabilities } from './modelCapabilities.server';
import { loadCatalog } from './modelsDevCatalog.server';
import { hasEntitlement } from '@/lib/entitlements';
import { ServiceError } from '@/lib/serviceError';
import { ErrorCode } from '@/lib/errorCodes';
import { StatusCodes } from 'http-status-codes';

const logger = createLogger('chat-utils');

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

/**
 * Eagerly warms the models.dev capability catalog at server startup so the first
 * request after a cold start resolves real model capabilities instead of the
 * text-only fallback. No-op when no language models are configured (avoids a
 * gratuitous outbound call for deployments not using Ask). Best-effort and
 * non-blocking: loadCatalog kicks off a background fetch and returns immediately,
 * and any unexpected error is logged rather than surfaced.
 */
export const warmModelCapabilitiesCatalog = (): void => {
    void (async () => {
        const configuredModels = await getConfiguredLanguageModels();
        if (configuredModels.length === 0) {
            return;
        }
        logger.info(`Warming models.dev capability catalog for ${configuredModels.length} configured language model(s)`);
        void loadCatalog();
    })().catch((error) => {
        logger.error(`Failed to warm models.dev capability catalog: ${error}`);
    });
};
