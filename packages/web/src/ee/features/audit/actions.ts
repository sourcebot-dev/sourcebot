"use server";

import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { sew } from "@/sew";
import { withAuthV2 } from "@/withAuthV2";
import { withMinimumOrgRole } from "@/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/logger";
import { ServiceError } from "@/lib/serviceError";
import { getAuditService } from "@/ee/features/audit/factory";
import { AuditEvent } from "./types";

const auditService = getAuditService();
const logger = createLogger('audit-utils');

export const createAuditAction = async (event: Omit<AuditEvent, 'sourcebotVersion' | 'orgId' | 'actor' | 'target'>, _domain: string) => sew(async () =>
  withAuthV2(async ({ user, org }) => {
    await auditService.createAudit({ ...event, orgId: org.id, actor: { id: user.id, type: "user" }, target: { id: org.id.toString(), type: "org" } })
  })
);

export const fetchAuditRecords = async (domain: string, _apiKey: string | undefined = undefined) => sew(() =>
  withAuthV2(async ({ user, org, prisma, role }) =>
    withMinimumOrgRole(role, OrgRole.OWNER, async () => {
      try {
        const auditRecords = await prisma.audit.findMany({
          where: {
            orgId: org.id,
          },
          orderBy: {
            timestamp: 'desc'
          }
        });

        await auditService.createAudit({
          action: "audit.fetch",
          actor: {
            id: user.id,
            type: "user"
          },
          target: {
            id: org.id.toString(),
            type: "org"
          },
          orgId: org.id
        })

        return auditRecords;
      } catch (error) {
        logger.error('Error fetching audit logs', { error });
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.UNEXPECTED_ERROR,
            message: "Failed to fetch audit logs",
        } satisfies ServiceError;
      }
    })
  )
);
