'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { env } from "@/env.mjs";
import { notFound } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { OrgRole, Prisma } from "@sourcebot/db";
import { Message } from "ai";
import fs from 'fs';
import path from 'path';

export const createChat = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.create({
                data: {
                    orgId: org.id,
                    messages: [] as unknown as Prisma.InputJsonValue,
                    createdById: userId,
                },
            });

            return {
                id: chat.id,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const loadChatMessages = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                    createdById: userId,
                },
            });

            if (!chat) {
                return notFound();
            }

            return chat.messages as unknown as Message[];
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const saveChatMessages = async ({ chatId, messages }: { chatId: string, messages: Message[] }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                    createdById: userId,
                },
            });

            if (!chat) {
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
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const getRecentChats = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            // @todo: this should be filtered on the user
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
                    createdById: userId,
                },
            });

            if (!chat) {
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
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

export const deleteChat = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                    createdById: userId,
                },
            });

            if (!chat) {
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

export const getChatInfo = async ({ chatId }: { chatId: string }, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const chat = await prisma.chat.findUnique({
                where: {
                    id: chatId,
                    orgId: org.id,
                    createdById: userId,
                },
            });

            if (!chat) {
                return notFound();
            }

            return {
                name: chat.name,
            }
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
)
