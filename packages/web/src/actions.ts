'use server';

import Ajv from "ajv";
import { auth } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { encrypt } from "@sourcebot/crypto"
import { getConnection } from "./data/connection";
import { ConnectionSyncStatus, Invite, Prisma } from "@sourcebot/db";
import { Session } from "next-auth";

const ajv = new Ajv({
    validateFormats: false,
});

export const withAuth = async <T>(fn: (session: Session) => Promise<T>) => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }
    return fn(session);
}

export const withOrgMembership = async <T>(session: Session, domain: string, fn: (orgId: number) => Promise<T>) => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (!org) {
        return notFound();
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId: org.id,
            }
        },
    });

    if (!membership) {
        return notFound();
    }

    return fn(org.id);
}

export const createOrg = (name: string, domain: string): Promise<{ id: number } | ServiceError> =>
    withAuth(async (session) => {
        const org = await prisma.org.create({
            data: {
                name,
                domain,
                members: {
                    create: {
                        role: "OWNER",
                        user: {
                            connect: {
                                id: session.user.id,
                            }
                        }
                    }
                }
            }
        });

        return {
            id: org.id,
        }
    });

export const getSecrets = (domain: string): Promise<{ createdAt: Date; key: string; }[] | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const secrets = await prisma.secret.findMany({
                where: {
                    orgId,
                },
                select: {
                    key: true,
                    createdAt: true
                }
            });

            return secrets.map((secret) => ({
                key: secret.key,
                createdAt: secret.createdAt,
            }));

        }));

export const createSecret = async (key: string, value: string, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            try {
                const encrypted = encrypt(value);
                await prisma.secret.create({
                    data: {
                        orgId,
                        key,
                        encryptedValue: encrypted.encryptedData,
                        iv: encrypted.iv,
                    }
                });
            } catch {
                return unexpectedError(`Failed to create secret`);
            }

            return {
                success: true,
            }
        }));

export const deleteSecret = async (key: string, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            await prisma.secret.delete({
                where: {
                    orgId_key: {
                        orgId,
                        key,
                    }
                }
            });

            return {
                success: true,
            }
        }));


export const getConnections = async (domain: string): Promise<
    {
        id: number,
        name: string,
        syncStatus: ConnectionSyncStatus,
        connectionType: string,
        updatedAt: Date,
        syncedAt?: Date
    }[] | ServiceError
> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const connections = await prisma.connection.findMany({
                where: {
                    orgId,
                },
            });

            return connections.map((connection) => ({
                id: connection.id,
                name: connection.name,
                syncStatus: connection.syncStatus,
                connectionType: connection.connectionType,
                updatedAt: connection.updatedAt,
                syncedAt: connection.syncedAt ?? undefined,
            }));
        })
    );


export const createConnection = async (name: string, type: string, connectionConfig: string, domain: string): Promise<{ id: number } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const parsedConfig = parseConnectionConfig(type, connectionConfig);
            if (isServiceError(parsedConfig)) {
                return parsedConfig;
            }

            const connection = await prisma.connection.create({
                data: {
                    orgId,
                    name,
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    connectionType: type,
                }
            });

            return {
                id: connection.id,
            }
        }));

export const updateConnectionDisplayName = async (connectionId: number, name: string, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            await prisma.connection.update({
                where: {
                    id: connectionId,
                    orgId,
                },
                data: {
                    name,
                }
            });

            return {
                success: true,
            }
        }));

export const updateConnectionConfigAndScheduleSync = async (connectionId: number, config: string, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            const parsedConfig = parseConnectionConfig(connection.connectionType, config);
            if (isServiceError(parsedConfig)) {
                return parsedConfig;
            }

            if (connection.syncStatus === "SYNC_NEEDED" ||
                connection.syncStatus === "IN_SYNC_QUEUE" ||
                connection.syncStatus === "SYNCING") {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.CONNECTION_SYNC_ALREADY_SCHEDULED,
                    message: "Connection is already syncing. Please wait for the sync to complete before updating the connection.",
                } satisfies ServiceError;
            }

            await prisma.connection.update({
                where: {
                    id: connectionId,
                    orgId,
                },
                data: {
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    syncStatus: "SYNC_NEEDED",
                }
            });

            return {
                success: true,
            }
        }));

export const deleteConnection = async (connectionId: number, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            await prisma.connection.delete({
                where: {
                    id: connectionId,
                    orgId,
                }
            });

            return {
                success: true,
            }
        }));

export const createInvite = async (email: string, userId: string, domain: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            console.log("Creating invite for", email, userId, orgId);

            try {
                await prisma.invite.create({
                    data: {
                        recipientEmail: email,
                        hostUserId: userId,
                        orgId,
                    }
                });
            } catch (error) {
                console.error("Failed to create invite:", error);
                return unexpectedError("Failed to create invite");
            }

            return {
                success: true,
            }
        })
    );

export const redeemInvite = async (invite: Invite, userId: string): Promise<{ success: boolean } | ServiceError> =>
    withAuth(async () => {
        try {
            await prisma.$transaction(async (tx) => {
                await tx.userToOrg.create({
                    data: {
                        userId,
                        orgId: invite.orgId,
                        role: "MEMBER",
                    }
                });

                await tx.invite.delete({
                    where: {
                        id: invite.id,
                    }
                });
            });

            return {
                success: true,
            }
        } catch (error) {
            console.error("Failed to redeem invite:", error);
            return unexpectedError("Failed to redeem invite");
        }
    });

const parseConnectionConfig = (connectionType: string, config: string) => {
    let parsedConfig: ConnectionConfig;
    try {
        parsedConfig = JSON.parse(config);
    } catch (_e) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "config must be a valid JSON object."
        } satisfies ServiceError;
    }

    const schema = (() => {
        switch (connectionType) {
            case "github":
                return githubSchema;
            case "gitlab":
                return gitlabSchema;
        }
    })();

    if (!schema) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "invalid connection type",
        } satisfies ServiceError;
    }

    const isValidConfig = ajv.validate(schema, parsedConfig);
    if (!isValidConfig) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `config schema validation failed with errors: ${ajv.errorsText(ajv.errors)}`,
        } satisfies ServiceError;
    }

    return parsedConfig;
}
