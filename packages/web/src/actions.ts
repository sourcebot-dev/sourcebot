'use server';

import Ajv from "ajv";
import { auth, getCurrentUserOrg } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError, serviceErrorResponse } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { encrypt } from "@sourcebot/crypto"

const ajv = new Ajv({
    validateFormats: false,
});

export const createSecret = async (key: string, value: string): Promise<{ success: boolean } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
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
    } catch {
        return unexpectedError(`Failed to create secret`);
    }

    return {
        success: true,
    }
}

export const getSecrets = async (): Promise<{ createdAt: Date; key: string; }[] | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
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

    return secrets.map((secret) => ({
        key: secret.key,
        createdAt: secret.createdAt,
    }));
}

export const deleteSecret = async (key: string): Promise<{ success: boolean } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

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
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
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