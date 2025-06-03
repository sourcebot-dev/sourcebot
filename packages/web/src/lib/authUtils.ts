import type { User as AuthJsUser } from "next-auth";
import { env } from "@/env.mjs";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { hasEntitlement } from "@/features/entitlements/server";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { createAccountRequest } from "@/actions";
import { handleJITProvisioning } from "@/ee/sso/sso";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('web-auth-utils');

export const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
    // In single-tenant mode, we assign the first user to sign
    // up as the owner of the default org.
    if (
        env.SOURCEBOT_TENANCY_MODE === 'single'
    ) {
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

        if (!defaultOrg) {
            throw new Error("Default org not found on single tenant user creation");
        }

        // We can't use the getOrgMembers action here because we're not authed yet
        const members = await prisma.userToOrg.findMany({
            where: {
                orgId: SINGLE_TENANT_ORG_ID,
                role: {
                    not: OrgRole.GUEST,
                }
            },
        });

        // Only the first user to sign up will be an owner of the default org.
        const isFirstUser = members.length === 0;
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

                await tx.user.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        pendingApproval: false,
                    }
                });
            });
        } else {
            // TODO(auth): handle multi tenant case
            if (env.AUTH_EE_ENABLE_JIT_PROVISIONING === 'true' && hasEntitlement("sso")) {
                const res = await handleJITProvisioning(user.id!, SINGLE_TENANT_ORG_DOMAIN);
                if (isServiceError(res)) {
                    logger.error(`Failed to provision user ${user.id} for org ${SINGLE_TENANT_ORG_DOMAIN}: ${res.message}`);
                    throw new ServiceErrorException(res);
                }
            } else {
                const res = await createAccountRequest(user.id!, SINGLE_TENANT_ORG_DOMAIN);
                if (isServiceError(res)) {
                    logger.error(`Failed to provision user ${user.id} for org ${SINGLE_TENANT_ORG_DOMAIN}: ${res.message}`);
                    throw new ServiceErrorException(res);
                }
            }
        }
    }
}; 