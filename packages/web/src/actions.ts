'use server';

import Ajv from "ajv";
import { auth, getCurrentUserOrg } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError, orgDomainExists } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { encrypt } from "@sourcebot/crypto"
import { getConnection } from "./data/connection";
import { Prisma, Invite } from "@sourcebot/db";
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { getUser } from "@/data/user";

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

export const checkIfOrgDomainExists = async (domain: string): Promise<boolean> => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        }
    });

    return !!org;
}

export const createOrg = async (name: string, domain: string, stripeSessionId?: string): Promise<{ id: number } | ServiceError> => {
    const session = await auth();
    if (!session) {
        return notAuthenticated();
    }

    const existingOrg = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (existingOrg) {
        return orgDomainExists();
    }

    // Create the org
    const org = await prisma.org.create({
        data: {
            name,
            domain,
            stripeSessionId,
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

export const createConnection = async (name: string, type: string, connectionConfig: string): Promise<{ id: number } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

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
}

export const updateConnectionDisplayName = async (connectionId: number, name: string): Promise<{ success: boolean } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

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
}

export const updateConnectionConfigAndScheduleSync = async (connectionId: number, config: string): Promise<{ success: boolean } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

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
}

export const deleteConnection = async (connectionId: number): Promise<{ success: boolean } | ServiceError> => {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

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
}

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

export const createInvite = async (email: string, userId: string, orgId: number): Promise<{ success: boolean } | ServiceError> => {
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
}

export const redeemInvite = async (invite: Invite, userId: string): Promise<{ orgId: number } | ServiceError> => {
    try {
        await prisma.userToOrg.create({
            data: {
                userId,
                orgId: invite.orgId,
                role: "MEMBER",
            }
        });

        await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                activeOrgId: invite.orgId,
            }
        });

        await prisma.invite.delete({
            where: {
                id: invite.id,
            }
        });

        return {
            orgId: invite.orgId,
        }
    } catch (error) {
        console.error("Failed to redeem invite:", error);
        return unexpectedError("Failed to redeem invite");
    }
}

export async function fetchStripeClientSecret(name: string, domain: string) {
    const session = await auth();
    if (!session) {
        return "";
    }
    const user = await getUser(session.user.id);
    if (!user) {
        return "";
    }

    const origin = (await headers()).get('origin')

    // Create Checkout Sessions from body params.
    const prices = await stripe.prices.list({
        product: 'prod_RkeYDKNFsZJROd',
        expand: ['data.product'],
    });
    const stripeSession = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',

        line_items: [
            {
                price: prices.data[0].id,
                quantity: 1
            }
        ],
        mode: 'subscription',
        subscription_data: {
            trial_period_days: 14
        },
        customer_email: user.email!,
        payment_method_collection: 'if_required',
        return_url: `${origin}/onboard/complete?session_id={CHECKOUT_SESSION_ID}&org_name=${name}&org_domain=${domain}`,
    })

    return stripeSession.client_secret!;
}

export async function fetchStripeSession(sessionId: string) {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    return stripeSession;
}

export async function createCustomerPortalSession() {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return orgId;
    }

    const org = await prisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org || !org.stripeSessionId) {
        return notFound();
    }

    const origin = (await headers()).get('origin')
    const stripeSession = await fetchStripeSession(org.stripeSessionId);
    const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeSession.customer as string,
        return_url: `${origin}/settings/billing`,
    });

    return portalSession;
}