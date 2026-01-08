'use server';

import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { OrgRole } from "@sourcebot/db";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse } from "@/lib/serviceError";
import { createLogger } from "@sourcebot/shared";
import { getAuditService } from "@/ee/features/audit/factory";

const logger = createLogger('ee-users-api');
const auditService = getAuditService();

export const GET = async () => {
    const result = await withAuthV2(async ({ prisma, org, role, user }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const memberships = await prisma.userToOrg.findMany({
                    where: {
                        orgId: org.id,
                    },
                    include: {
                        user: true,
                    },
                });

                const usersWithActivity = await Promise.all(
                    memberships.map(async (membership) => {
                        const lastActivity = await prisma.audit.findFirst({
                            where: {
                                actorId: membership.user.id,
                                actorType: 'user',
                                orgId: org.id,
                            },
                            orderBy: {
                                timestamp: 'desc',
                            },
                            select: {
                                timestamp: true,
                            },
                        });

                        return {
                            id: membership.user.id,
                            name: membership.user.name,
                            email: membership.user.email,
                            role: membership.role,
                            createdAt: membership.user.createdAt,
                            lastActivityAt: lastActivity?.timestamp ?? null,
                        };
                    })
                );

                await auditService.createAudit({
                    action: "user.list",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: org.id.toString(),
                        type: "org"
                    },
                    orgId: org.id
                });

                logger.info('Fetched users list', { count: usersWithActivity.length });
                return usersWithActivity;
            } catch (error) {
                logger.error('Error fetching users', { error });
                throw error;
            }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result);
};

