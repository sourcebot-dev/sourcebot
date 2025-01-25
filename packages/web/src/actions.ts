'use server';

import Ajv from "ajv";
import { getUser } from "./data/user";
import { auth } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError } from "./lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./lib/errorCodes";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { encrypt } from "@sourcebot/crypto"

const ajv = new Ajv({
    validateFormats: false,
});

export const createSecret = async (key: string, value: string): Promise<{ success: boolean } | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return unexpectedError("User not found");
    }
    const orgId = user.activeOrgId;
    if (!orgId) {
        return unexpectedError("User has no active org");
    }

    // @todo: refactor this into a shared function
    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

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
    } catch (e) {
        console.error(e);
        return unexpectedError(`Failed to create secret: ${e}`);
    }

    return {
        success: true,
    }
}

export const getSecrets = async (): Promise<{ createdAt: Date; key: string; }[] | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return unexpectedError("User not found");
    }
    const orgId = user.activeOrgId;
    if (!orgId) {
        return unexpectedError("User has no active org");
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

    const secrets = await prisma.secret.findMany({
        where: {
            orgId,
        },
        select: {
            key: true,
            createdAt: true
        }
    });

    return secrets;
}


export const createOrg = async (name: string): Promise<{ id: number } | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    // Create the org
    const org = await prisma.org.create({
        data: {
            name,
            members: {
                create: {
                    userId: session.user.id,
                    role: "OWNER",
                },
            },
        }
    });

    return {
        id: org.id,
    }
}

export const switchActiveOrg = async (orgId: number): Promise<{ id: number } | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    // Check to see if the user is a member of the org
    // @todo: refactor this into a shared function
    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

    // Update the user's active org
    await prisma.user.update({
        where: {
            id: session.user.id,
        },
        data: {
            activeOrgId: orgId,
        }
    });

    return {
        id: orgId,
    }
}

export const createConnection = async (config: string): Promise<{ id: number } | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    const user = await getUser(session.user.id);
    if (!user) {
        return unexpectedError("User not found");
    }
    const orgId = user.activeOrgId;
    if (!orgId) {
        return unexpectedError("User has no active org");
    }

    // @todo: refactor this into a shared function
    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId,
            }
        },
    });
    if (!membership) {
        return notFound();
    }

    let parsedConfig;
    try {
        parsedConfig = JSON.parse(config);
    } catch (e) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "config must be a valid JSON object."
        } satisfies ServiceError;
    }

    // @todo: we will need to validate the config against different schemas based on the type of connection.
    const isValidConfig = ajv.validate(githubSchema, parsedConfig);
    if (!isValidConfig) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `config schema validation failed with errors: ${ajv.errorsText(ajv.errors)}`,
        } satisfies ServiceError;
    }

    const connection = await prisma.connection.create({
        data: {
            orgId: orgId,
            config: parsedConfig,
        }
    });

    return {
        id: connection.id,
    }
}