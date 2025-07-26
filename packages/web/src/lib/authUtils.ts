import type { User as AuthJsUser } from "next-auth";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID, SOURCEBOT_GUEST_USER_EMAIL, SOURCEBOT_GUEST_USER_ID, SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { getPlan, getSeats, hasEntitlement, SOURCEBOT_UNLIMITED_SEATS } from "@sourcebot/shared";
import { isServiceError } from "@/lib/utils";
import { orgNotFound, ServiceError, userNotFound } from "@/lib/serviceError";
import { createLogger } from "@sourcebot/logger";
import { getAuditService } from "@/ee/features/audit/factory";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { incrementOrgSeatCount } from "@/ee/features/billing/serverUtils";
import { getOrgFromDomain } from "@/data/org";

const logger = createLogger('web-auth-utils');
const auditService = getAuditService();

export const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
    if (!user.id) {
        logger.error("User ID is undefined on user creation");
        await auditService.createAudit({
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

    const defaultOrg = await prisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        include: {
            members: {
                where: {
                    role: {
                        not: OrgRole.GUEST,
                    }
                }
            },
        }
    });

    // We expect the default org to have been created on app initialization
    if (defaultOrg === null) {
        await auditService.createAudit({
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

    // If this is the first user to sign up, we make them the owner of the default org.
    const isFirstUser = defaultOrg.members.length === 0;
    if (isFirstUser) {
        await prisma.$transaction(async (tx) => {
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

        await auditService.createAudit({
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
    } else if (!defaultOrg.memberApprovalRequired) { 
        const hasAvailability = await orgHasAvailability(defaultOrg.domain);
        if (!hasAvailability) {
            logger.warn(`onCreateUser: org ${SINGLE_TENANT_ORG_ID} has reached max capacity. User ${user.id} was not added to the org.`);
            return;
        }

        await prisma.userToOrg.create({
            data: {
                userId: user.id,
                orgId: SINGLE_TENANT_ORG_ID,
                role: OrgRole.MEMBER,
            }
        });
    }

};


export const createGuestUser = async (domain: string): Promise<ServiceError | boolean> => {
    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
    if (!hasAnonymousAccessEntitlement) {
        console.error(`Anonymous access isn't supported in your current plan: ${getPlan()}. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Public access is not supported in your current plan",
        } satisfies ServiceError;
    }

    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Organization not found",
        } satisfies ServiceError;
    }

    const user = await prisma.user.upsert({
        where: {
            id: SOURCEBOT_GUEST_USER_ID,
        },
        update: {},
        create: {
            id: SOURCEBOT_GUEST_USER_ID,
            name: "Guest",
            email: SOURCEBOT_GUEST_USER_EMAIL,
        },
    });

    await prisma.org.update({
        where: {
            id: org.id,
        },
        data: {
            members: {
                upsert: {
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId: user.id,
                        },
                    },
                    update: {},
                    create: {
                        role: OrgRole.GUEST,
                        user: {
                            connect: { id: user.id },
                        },
                    },
                },
            },
        },
    });

    return true;
};

export const orgHasAvailability = async (domain: string): Promise<boolean> => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (!org) {
        logger.error(`orgHasAvailability: org not found for domain ${domain}`);
        return false;
    }
    const members = await prisma.userToOrg.findMany({
        where: {
            orgId: org.id,
            role: {
                not: OrgRole.GUEST,
            },
        },
    });

    const maxSeats = getSeats();
    const memberCount = members.length;

    if (maxSeats !== SOURCEBOT_UNLIMITED_SEATS && memberCount >= maxSeats) {
        logger.error(`orgHasAvailability: org ${org.id} has reached max capacity`);
        return false;
    }

    return true;
}

export const addUserToOrganization = async (userId: string, orgId: number): Promise<{ success: boolean } | ServiceError> => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        logger.error(`addUserToOrganization: user not found for id ${userId}`);
        return userNotFound();
    }

    const org = await prisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org) {
        logger.error(`addUserToOrganization: org not found for id ${orgId}`);
        return orgNotFound();
    }

    const hasAvailability = await orgHasAvailability(org.domain);
    if (!hasAvailability) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
            message: "Organization is at max capacity",
        } satisfies ServiceError;
    }

    const res = await prisma.$transaction(async (tx) => {
        await tx.userToOrg.create({
            data: {
                userId: user.id,
                orgId: org.id,
                role: OrgRole.MEMBER,
            }
        });

        if (IS_BILLING_ENABLED) {
            const result = await incrementOrgSeatCount(orgId, tx);
            if (isServiceError(result)) {
                throw result;
            }
        }

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

    if (isServiceError(res)) {
        logger.error(`addUserToOrganization: failed to add user ${userId} to org ${orgId}: ${res.message}`);
        return res;
    }

    return {
        success: true,
    }
};