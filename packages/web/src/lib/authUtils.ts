import type { User as AuthJsUser } from "next-auth";
import { env } from "@/env.mjs";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { getSeats, SOURCEBOT_UNLIMITED_SEATS } from "@sourcebot/shared";
import { isServiceError } from "@/lib/utils";
import { orgNotFound, ServiceError, userNotFound } from "@/lib/serviceError";
import { createLogger } from "@sourcebot/logger";
import { getAuditService } from "@/ee/features/audit/factory";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { incrementOrgSeatCount } from "@/ee/features/billing/serverUtils";

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
            orgId: SINGLE_TENANT_ORG_ID, // TODO(mt)
            metadata: {
                message: "User ID is undefined on user creation"
            }
        });
        throw new Error("User ID is undefined on user creation");
    }

    // In single-tenant mode, we assign the first user to sign
    // up as the owner of the default org.
    if (env.SOURCEBOT_TENANCY_MODE === 'single') {
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

        // Only the first user to sign up will be an owner of the default org.
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
        }
    }
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
    });

    if (isServiceError(res)) {
        logger.error(`addUserToOrganization: failed to add user ${userId} to org ${orgId}: ${res.message}`);
        return res;
    }

    return {
        success: true,
    }
};