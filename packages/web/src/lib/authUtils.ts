import type { User as AuthJsUser } from "next-auth";
import { env } from "@/env.mjs";
import { prisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { hasEntitlement } from "@sourcebot/shared";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { createAccountRequest } from "@/actions";
import { handleJITProvisioning } from "@/ee/features/sso/sso";
import { createLogger } from "@sourcebot/logger";
import { getAuditService } from "@/ee/features/audit/factory";

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

                await tx.user.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        pendingApproval: false,
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
        } else {
            // TODO(auth): handle multi tenant case
            if (env.AUTH_EE_ENABLE_JIT_PROVISIONING === 'true' && hasEntitlement("sso")) {
                const res = await handleJITProvisioning(user.id, SINGLE_TENANT_ORG_DOMAIN);
                if (isServiceError(res)) {
                    logger.error(`Failed to provision user ${user.id} for org ${SINGLE_TENANT_ORG_DOMAIN}: ${res.message}`);
                    await auditService.createAudit({
                        action: "user.jit_provisioning_failed",
                        actor: {
                            id: user.id,
                            type: "user"
                        },
                        target: {
                            id: SINGLE_TENANT_ORG_ID.toString(),
                            type: "org"
                        },
                        orgId: SINGLE_TENANT_ORG_ID,
                        metadata: {
                            message: `Failed to provision user ${user.id} for org ${SINGLE_TENANT_ORG_DOMAIN}: ${res.message}`
                        }
                    });
                    throw new ServiceErrorException(res);
                }

                await auditService.createAudit({
                    action: "user.jit_provisioned",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: SINGLE_TENANT_ORG_ID.toString(),
                        type: "org"
                    },
                    orgId: SINGLE_TENANT_ORG_ID,
                });
            } else {
                const res = await createAccountRequest(user.id, SINGLE_TENANT_ORG_DOMAIN);
                if (isServiceError(res)) {
                    logger.error(`Failed to provision user ${user.id} for org ${SINGLE_TENANT_ORG_DOMAIN}: ${res.message}`);
                    await auditService.createAudit({
                        action: "user.join_request_creation_failed",
                        actor: {
                            id: user.id,
                            type: "user"
                        },
                        target: {
                            id: SINGLE_TENANT_ORG_ID.toString(),
                            type: "org"
                        },
                        orgId: SINGLE_TENANT_ORG_ID,
                        metadata: {
                            message: res.message
                        }
                    });
                    throw new ServiceErrorException(res);
                }

                await auditService.createAudit({
                    action: "user.join_requested",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    orgId: SINGLE_TENANT_ORG_ID,
                    target: {
                        id: SINGLE_TENANT_ORG_ID.toString(),
                        type: "org"
                    },
                });
            }
        }
    }
}; 