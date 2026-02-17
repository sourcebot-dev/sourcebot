'use server';

import { sew } from "@/actions";
import { getAuditService } from "@/ee/features/audit/factory";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, serviceErrorResponse } from "@/lib/serviceError";
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { AnthropicProviderOptions, createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI, OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { LanguageModelV2 as AISDKLanguageModelV2 } from "@ai-sdk/provider";
import { createXai } from '@ai-sdk/xai';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getTokenFromConfig, createLogger, env } from "@sourcebot/shared";
import { ChatVisibility, Prisma } from "@sourcebot/db";
import { LanguageModel } from "@sourcebot/schemas/v3/languageModel.type";
import { Token } from "@sourcebot/schemas/v3/shared.type";
import { generateText, JSONValue, extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { loadConfig } from "@sourcebot/shared";
import fs from 'fs';
import { StatusCodes } from "http-status-codes";
import path from 'path';
import { LanguageModelInfo, SBChatMessage } from "./types";
import { withAuthV2, withOptionalAuthV2 } from "@/withAuthV2";
import { getAnonymousId, getOrCreateAnonymousId } from "@/lib/anonymousId";
import { Chat, PrismaClient, User } from "@sourcebot/db";
import { captureEvent } from "@/lib/posthog";

const logger = createLogger('chat-actions');
const auditService = getAuditService();

/**
 * Checks if the current user (authenticated or anonymous) is the owner of a chat.
 */
export const _isOwnerOfChat = async (chat: Chat, user: User | undefined): Promise<boolean> => {
    // Authenticated user owns the chat
    if (user && chat.createdById === user.id) {
        return true;
    }

    // Anonymous user owns the chat (check cookie-based anonymous ID)
    if (!user && chat.anonymousCreatorId) {
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
export const _hasSharedAccess = async ({prisma, chatId, userId}: {prisma: PrismaClient, chatId: string, userId: string | undefined}): Promise<boolean> => {
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

export const createChat = async () => sew(() =>
    withOptionalAuthV2(async ({ org, user, prisma }) => {
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
            await auditService.createAudit({
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
            });
        }

        return {
            id: chat.id,
        }
    })
);

export const getChatInfo = async ({ chatId }: { chatId: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        const isOwner = await _isOwnerOfChat(chat, user);
        const isSharedWithUser = await _hasSharedAccess({prisma, chatId, userId: user?.id});

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

export const updateChatMessages = async ({ chatId, messages }: { chatId: string, messages: SBChatMessage[] }) => sew(() =>
    withOptionalAuthV2(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        const isOwner = await _isOwnerOfChat(chat, user);

        // Only the owner can modify chat messages
        if (!isOwner) {
            return notFound();
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
    })
);

export const getUserChatHistory = async () => sew(() =>
    withAuthV2(async ({ org, user, prisma }) => {
        const chats = await prisma.chat.findMany({
            where: {
                orgId: org.id,
                createdById: user.id,
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
);

export const updateChatName = async ({ chatId, name }: { chatId: string, name: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, user, prisma }) => {
        const chat = await prisma.chat.findUnique({
            where: {
                id: chatId,
                orgId: org.id,
            },
        });

        if (!chat) {
            return notFound();
        }

        const isOwner = await _isOwnerOfChat(chat, user);

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
    withAuthV2(async ({ org, user, prisma }) => {
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

        return {
            success: true,
        }
    })
);

export const generateAndUpdateChatNameFromMessage = async ({ chatId, languageModelId, message }: { chatId: string, languageModelId: string, message: string }) => sew(() =>
    withOptionalAuthV2(async () => {
            // From the language model ID, attempt to find the
            // corresponding config in `config.json`.
            const languageModelConfig =
                (await _getConfiguredLanguageModelsFull())
                    .find((model) => model.model === languageModelId);

            if (!languageModelConfig) {
                return serviceErrorResponse({
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Language model ${languageModelId} is not configured.`,
                });
            }

            const { model } = await _getAISDKLanguageModelAndOptions(languageModelConfig);

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
            });

            await updateChatName({
                chatId,
                name: result.text,
            });

            return {
                success: true,
            }
        })
    )

export const deleteChat = async ({ chatId }: { chatId: string }) => sew(() =>
    withAuthV2(async ({ org, user, prisma }) => {
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
    withAuthV2(async ({ org, user, prisma }) => {
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
    withOptionalAuthV2(async ({ org, user, prisma }) => {
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
        const isOwner = await _isOwnerOfChat(originalChat, user);
        const isSharedWithUser = await _hasSharedAccess({prisma, chatId, userId: user?.id});
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
    withAuthV2(async ({ org, user, prisma }) => {
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
    withAuthV2(async ({ org, user, prisma }) => {
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

        return { success: true };
    })
);

/**
 * Revokes access to a chat for a particular user.
 */
export const unshareChatWithUser = async ({ chatId, userId }: { chatId: string, userId: string }) => sew(() =>
    withAuthV2(async ({ org, user, prisma }) => {
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

        await prisma.chatAccess.delete({
            where: {
                chatId_userId: {
                    chatId,
                    userId,
                },
            },
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
    withOptionalAuthV2(async ({ org, user, prisma }) => {
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
        const isSharedWithUser = await _hasSharedAccess({prisma, chatId, userId: user?.id});
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
    try {
        const config = await loadConfig(env.CONFIG_PATH);
        return config.models ?? [];
    } catch (error) {
        logger.error('Failed to load language model configuration', error);
        return [];
    }
}

export const _getAISDKLanguageModelAndOptions = async (config: LanguageModel): Promise<{
    model: AISDKLanguageModelV2,
    providerOptions?: Record<string, Record<string, JSONValue>>,
}> => {
    const { provider, model: modelId } = config;

    switch (provider) {
        case 'amazon-bedrock': {
            const aws = createAmazonBedrock({
                baseURL: config.baseUrl,
                region: config.region ?? env.AWS_REGION,
                accessKeyId: config.accessKeyId
                    ? await getTokenFromConfig(config.accessKeyId)
                    : env.AWS_ACCESS_KEY_ID,
                secretAccessKey: config.accessKeySecret
                    ? await getTokenFromConfig(config.accessKeySecret)
                    : env.AWS_SECRET_ACCESS_KEY,
                sessionToken: config.sessionToken
                    ? await getTokenFromConfig(config.sessionToken)
                    : env.AWS_SESSION_TOKEN,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
                // Fallback to the default Node.js credential provider chain if no credentials are provided.
                // See: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/#fromnodeproviderchain
                credentialProvider: !config.accessKeyId && !config.accessKeySecret && !config.sessionToken
                    ? fromNodeProviderChain()
                    : undefined,
            });

            return {
                model: aws(modelId),
            };
        }
        case 'anthropic': {
            const anthropic = createAnthropic({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.ANTHROPIC_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: anthropic(modelId),
                providerOptions: {
                    anthropic: {
                        thinking: {
                            type: "enabled",
                            budgetTokens: env.ANTHROPIC_THINKING_BUDGET_TOKENS,
                        }
                    } satisfies AnthropicProviderOptions,
                },
            };
        }
        case 'azure': {
            const azure = createAzure({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.AZURE_API_KEY,
                apiVersion: config.apiVersion,
                resourceName: config.resourceName ?? env.AZURE_RESOURCE_NAME,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: azure(modelId),
            };
        }
        case 'deepseek': {
            const deepseek = createDeepSeek({
                baseURL: config.baseUrl,
                apiKey: config.token ? (await getTokenFromConfig(config.token)) : env.DEEPSEEK_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: deepseek(modelId),
            };
        }
        case 'google-generative-ai': {
            const google = createGoogleGenerativeAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.GOOGLE_GENERATIVE_AI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: google(modelId),
            };
        }
        case 'google-vertex': {
            const vertex = createVertex({
                project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                location: config.region ?? env.GOOGLE_VERTEX_REGION,
                ...(config.credentials ? {
                    googleAuthOptions: {
                        keyFilename: await getTokenFromConfig(config.credentials),
                    }
                } : {}),
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: vertex(modelId),
                providerOptions: {
                    google: {
                        thinkingConfig: {
                            thinkingBudget: env.GOOGLE_VERTEX_THINKING_BUDGET_TOKENS,
                            includeThoughts: env.GOOGLE_VERTEX_INCLUDE_THOUGHTS === 'true',
                        }
                    }
                },
            };
        }
        case 'google-vertex-anthropic': {
            const vertexAnthropic = createVertexAnthropic({
                project: config.project ?? env.GOOGLE_VERTEX_PROJECT,
                location: config.region ?? env.GOOGLE_VERTEX_REGION,
                ...(config.credentials ? {
                    googleAuthOptions: {
                        keyFilename: await getTokenFromConfig(config.credentials),
                    }
                } : {}),
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: vertexAnthropic(modelId),
            };
        }
        case 'mistral': {
            const mistral = createMistral({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.MISTRAL_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: mistral(modelId),
            };
        }
        case 'openai': {
            const openai = createOpenAI({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.OPENAI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: openai(modelId),
                providerOptions: {
                    openai: {
                        reasoningEffort: config.reasoningEffort ?? 'medium',
                    } satisfies OpenAIResponsesProviderOptions,
                },
            };
        }
        case 'openai-compatible': {
            const openai = createOpenAICompatible({
                baseURL: config.baseUrl,
                name: config.displayName ?? modelId,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : undefined,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
                queryParams: config.queryParams
                    ? await extractLanguageModelKeyValuePairs(config.queryParams)
                    : undefined,
            });

            const model = wrapLanguageModel({
                model: openai.chatModel(modelId),
                middleware: [
                    extractReasoningMiddleware({
                        tagName: config.reasoningTag ?? 'think',
                    }),
                ]
            });

            return {
                model,
            }
        }
        case 'openrouter': {
            const openrouter = createOpenRouter({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.OPENROUTER_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: openrouter(modelId),
            };
        }
        case 'xai': {
            const xai = createXai({
                baseURL: config.baseUrl,
                apiKey: config.token
                    ? await getTokenFromConfig(config.token)
                    : env.XAI_API_KEY,
                headers: config.headers
                    ? await extractLanguageModelKeyValuePairs(config.headers)
                    : undefined,
            });

            return {
                model: xai(modelId),
            };
        }
    }
}

const extractLanguageModelKeyValuePairs = async (
    pairs: {
        [k: string]: string | Token;
    }
): Promise<Record<string, string>> => {
    const resolvedPairs: Record<string, string> = {};

    if (!pairs) {
        return resolvedPairs;
    }

    for (const [key, val] of Object.entries(pairs)) {
        if (typeof val === "string") {
            resolvedPairs[key] = val;
            continue;
        }

        const value = await getTokenFromConfig(val);
        resolvedPairs[key] = value;
    }

    return resolvedPairs;
}
