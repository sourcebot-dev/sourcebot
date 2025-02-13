'use server';

import Ajv from "ajv";
import { auth } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError, orgInvalidSubscription } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { encrypt } from "@sourcebot/crypto"
import { getConnection } from "./data/connection";
import { ConnectionSyncStatus, Prisma, Invite } from "@sourcebot/db";
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { getUser } from "@/data/user";
import { Session } from "next-auth";
import Stripe from "stripe";

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

export const isAuthed = async () => {
    const session = await auth();
    return session != null;
}

export const createOrg = (name: string, domain: string, stripeCustomerId?: string): Promise<{ id: number } | ServiceError> =>
    withAuth(async (session) => {
        const org = await prisma.org.create({
            data: {
                name,
                domain,
                stripeCustomerId,
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
                const org = await tx.org.findUnique({
                    where: {
                        id: invite.orgId,
                    }
                });

                if (!org) {
                    return notFound();
                }

                // Incrememnt the seat count. We check if the subscription is valid in the redeem page so we return an error if that's not the case here
                if (org.stripeCustomerId) {
                    const subscription = await fetchSubscription(org.id);
                    if (isServiceError(subscription)) {
                        return orgInvalidSubscription();
                    }

                    const existingSeatCount = subscription.items.data[0].quantity;
                    const newSeatCount = (existingSeatCount || 1) + 1

                    await stripe.subscriptionItems.update(
                        subscription.items.data[0].id,
                        {
                            quantity: newSeatCount,
                            proration_behavior: 'create_prorations',
                        }
                    )
                }

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

    const test_clock = await stripe.testHelpers.testClocks.create({
        frozen_time: Math.floor(Date.now() / 1000)
    })

    const customer = await stripe.customers.create({
        name: user.name!,
        email: user.email!,
        test_clock: test_clock.id
    })

    const prices = await stripe.prices.list({
        product: 'prod_RkeYDKNFsZJROd',
        expand: ['data.product'],
    });
    const stripeSession = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        customer: customer.id,
        line_items: [
            {
                price: prices.data[0].id,
                quantity: 1
            }
        ],
        mode: 'subscription',
        subscription_data: {
            trial_period_days: 7,
            trial_settings: {
                end_behavior: {
                    missing_payment_method: 'cancel',
                },
            },
        },
        payment_method_collection: 'if_required',
        return_url: `${origin}/onboard/complete?session_id={CHECKOUT_SESSION_ID}&org_name=${name}&org_domain=${domain}`,
    })

    return stripeSession.client_secret!;
}

export const getSubscriptionCheckoutRedirect = async (domain: string) =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            const orgMembers = await prisma.userToOrg.findMany({
                where: {
                    orgId,
                },
                select: {
                    userId: true,
                }
            });
            const numOrgMembers = orgMembers.length;

            const origin = (await headers()).get('origin')
            const prices = await stripe.prices.list({
                product: 'prod_RkeYDKNFsZJROd',
                expand: ['data.product'],
            });

            const createNewSubscription = async () => {
                const stripeSession = await stripe.checkout.sessions.create({
                    customer: org.stripeCustomerId as string,
                    payment_method_types: ['card'],
                    line_items: [
                        {
                            price: prices.data[0].id,
                            quantity: numOrgMembers
                        }
                    ],
                    mode: 'subscription',
                    payment_method_collection: 'always',
                    success_url: `${origin}/${domain}/settings/billing`,
                    cancel_url: `${origin}/${domain}`,
                });

                return stripeSession.url;
            }

            const newSubscriptionUrl = await createNewSubscription();
            return newSubscriptionUrl;
        })
    )

export async function fetchStripeSession(sessionId: string) {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    return stripeSession;
}

export const getCustomerPortalSessionLink = async (domain: string): Promise<string | ServiceError> =>
    withAuth((session) =>
        withOrgMembership(session, domain, async (orgId) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            const origin = (await headers()).get('origin')
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: org.stripeCustomerId as string,
                return_url: `${origin}/${domain}/settings/billing`,
            });

            return portalSession.url;
        }));

export async function fetchSubscription(orgId: number) {
    const org = await prisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org || !org.stripeCustomerId) {
        return notFound();
    }

    const subscriptions = await stripe.subscriptions.list({
        customer: org.stripeCustomerId!
    })

    if (subscriptions.data.length === 0) {
        return notFound();
    }
    return subscriptions.data[0];
}

export const checkIfOrgDomainExists = async (domain: string): Promise<boolean | ServiceError> =>
    withAuth(async (session) => {
        const org = await prisma.org.findFirst({
            where: {
                domain,
            }
        });

        return !!org;
    });
