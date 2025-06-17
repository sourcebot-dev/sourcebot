import { prisma } from "@/prisma";
import { serviceErrorResponse } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { OrgRole } from "@sourcebot/db";

export const fetchAuditRecords = async (domain: string, apiKey: string | undefined = undefined) => sew(() =>
  withAuth((userId) =>
    withOrgMembership(userId, domain, async ({ org }) => {
      try {
        const auditRecords = await prisma.audit.findMany({
          where: {
            orgId: org.id,
          },
          orderBy: {
            timestamp: 'desc'
          }
        });

        return auditRecords;
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        return serviceErrorResponse({
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          errorCode: ErrorCode.UNEXPECTED_ERROR,
          message: "Failed to fetch audit logs",
        });
      }
    }, /* minRequiredRole = */ OrgRole.OWNER), /* allowSingleTenantUnauthedAccess = */ true, apiKey ? { apiKey, domain } : undefined)
);
