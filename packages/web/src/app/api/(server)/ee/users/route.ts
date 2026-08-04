'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { toPublicUser } from "../utils";
import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

const logger = createLogger('ee-users-api');

export const GET = apiHandler(async () => {
    if (!await hasEntitlement('org-management')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Organization management is not enabled for your license",
        });
    }

    const result = await withAuth(async ({ prisma, org, role, user }) => {
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

                const users = memberships.map((membership) => toPublicUser(membership));

                await createAudit({
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

                logger.info('Fetched users list', { count: users.length });
                return users;
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
});
