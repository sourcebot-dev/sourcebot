import type { User as AuthJsUser } from "next-auth";
import { __unsafePrisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { orgNotFound, ServiceError, userNotFound } from "@/lib/serviceError";
import { createLogger, getSeatCap } from "@sourcebot/shared";
import { createAudit } from "@/ee/features/audit/audit";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";

const logger = createLogger('web-auth-utils');

export const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
    if (!user.id) {
        logger.error("User ID is undefined on user creation");
        await createAudit({
            action: "user.creation_failed",
            actor: {
                id: "undefined",
                type: "user"
            },
            target: {
                id: "undefined",
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            metadata: {
                message: "User ID is undefined on user creation"
            }
        });
        throw new Error("User ID is undefined on user creation");
    }

    const defaultOrg = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        include: {
            members: true,
        }
    });

    if (defaultOrg === null) {
        await createAudit({
            action: "user.creation_failed",
            actor: {
                id: user.id,
                type: "user"
            },
            target: {
                id: user.id,
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            metadata: {
                message: "Default org not found on single tenant user creation"
            }
        });
        throw new Error("Default org not found on single tenant user creation");
    }

    // First user to sign up bootstraps the org as its OWNER. This is how a
    // fresh deployment gets its initial admin without manual setup.
    const isFirstUser = defaultOrg.members.length === 0;
    if (isFirstUser) {
        await __unsafePrisma.$transaction(async (tx) => {
            await tx.org.update({
                where: {
                    id: SINGLE_TENANT_ORG_ID,
                },
                data: {
                    members: {
                        create: {
                            role: OrgRole.OWNER,
                            user: {
                                connect: {
                                    id: user.id,
                                }
                            }
                        }
                    }
                }
            });
        });

        await createAudit({
            action: "user.owner_created",
            actor: {
                id: user.id,
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            target: {
                id: SINGLE_TENANT_ORG_ID.toString(),
                type: "org"
            }
        });
    }

    // Subsequent users auto-join as MEMBER only when the org is in open
    // self-serve mode. If memberApprovalRequired is true, the user is left
    // without a membership and must submit an AccountRequest for an owner to
    // approve via addUserToOrganization.
    else if (!defaultOrg.memberApprovalRequired) {
        // Don't exceed the licensed seat count. The user row still exists;
        // they just aren't attached to the org until a seat frees up.
        const hasAvailability = await orgHasAvailability(defaultOrg.id);
        if (!hasAvailability) {
            logger.warn(`onCreateUser: org ${SINGLE_TENANT_ORG_ID} has reached max capacity. User ${user.id} was not added to the org.`);
            return;
        }

        await __unsafePrisma.userToOrg.create({
            data: {
                userId: user.id,
                orgId: SINGLE_TENANT_ORG_ID,
                role: OrgRole.MEMBER,
            }
        });
    }

    // Dynamic import to avoid circular dependency:
    // authUtils -> posthog -> auth -> authUtils
    const { captureEvent } = await import("@/lib/posthog");
    await captureEvent('wa_user_created', { userId: user.id });

    // Sync with lighthouse s.t., the subscription
    // quantity will update immediately.
    await syncWithLighthouse(defaultOrg.id);
};


/**
 * Checks to see if the given organization has seat availability.
 * Seat availability is determined by the `seats` parameter in
 * the offline license key, if available.
 */
export const orgHasAvailability = async (orgId: number): Promise<boolean> => {
    const org = await __unsafePrisma.org.findUniqueOrThrow({
        where: {
            id: orgId,
        },
        include: {
            members: true,
        }
    });

    const seatCap = getSeatCap();
    const memberCount = org.members.length;

    if (
        seatCap &&
        memberCount >= seatCap
    ) {
        logger.error(`orgHasAvailability: org ${org.id} has reached max capacity`);
        return false;
    }

    return true;
}

export const addUserToOrganization = async (userId: string, orgId: number): Promise<{ success: boolean } | ServiceError> => {
    const user = await __unsafePrisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        logger.error(`addUserToOrganization: user not found for id ${userId}`);
        return userNotFound();
    }

    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org) {
        logger.error(`addUserToOrganization: org not found for id ${orgId}`);
        return orgNotFound();
    }

    const hasAvailability = await orgHasAvailability(org.id);
    if (!hasAvailability) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
            message: "Organization is at max capacity",
        } satisfies ServiceError;
    }

    await __unsafePrisma.$transaction(async (tx) => {
        // Upsert rather than create: the user may already be a member from the
        // self-serve auto-join in onCreateUser, in which case this call is
        // just here to trigger the AccountRequest / Invite cleanup below.
        await tx.userToOrg.upsert({
            where: {
                orgId_userId: {
                    orgId: org.id,
                    userId: user.id,
                },
            },
            create: {
                userId: user.id,
                orgId: org.id,
                role: OrgRole.MEMBER,
            },
            update: {},
        });

        // Delete the account request if it exists since we've added the user to the org
        const accountRequest = await tx.accountRequest.findUnique({
            where: {
                requestedById_orgId: {
                    requestedById: user.id,
                    orgId: orgId,
                }
            },
        });

        if (accountRequest) {
            logger.info(`Deleting account request ${accountRequest.id} for user ${user.id} since they've been added to the org`);
            await tx.accountRequest.delete({
                where: {
                    id: accountRequest.id,
                }
            });
        }

        // Delete any invites that may exist for this user since we've added them to the org
        const invites = await tx.invite.findMany({
            where: {
                recipientEmail: user.email!,
                orgId: org.id,
            },
        })

        for (const invite of invites) {
            logger.info(`Deleting invite ${invite.id} for ${user.email} since they've been added to the org`);
            await tx.invite.delete({
                where: {
                    id: invite.id,
                },
            });
        }
    });

    // Sync with lighthouse s.t., the subscription
    // quantity will update immediately.
    await syncWithLighthouse(org.id);

    return {
        success: true,
    }
};