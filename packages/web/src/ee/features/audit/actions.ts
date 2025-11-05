"use server";

import { prisma } from "@/prisma";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";
import { sew, withAuth, withOrgMembership } from "@/actions";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { ServiceError } from "@/lib/serviceError";
import { getAuditService } from "@/ee/features/audit/factory";
import { AuditEvent } from "./types";

const auditService = getAuditService();
const logger = createLogger('audit-utils');

export const createAuditAction = async (event: Omit<AuditEvent, 'sourcebotVersion' | 'orgId' | 'actor' | 'target'>, domain: string) => sew(async () =>
  withAuth((userId) =>
    withOrgMembership(userId, domain, async ({ org }) => {
      await auditService.createAudit({ ...event, orgId: org.id, actor: { id: userId, type: "user" }, target: { id: org.id.toString(), type: "org" } })
    }, /* minRequiredRole = */ OrgRole.MEMBER), /* allowAnonymousAccess = */ true)
);

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

        await auditService.createAudit({
          action: "audit.fetch",
          actor: {
            id: userId,
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
    }, /* minRequiredRole = */ OrgRole.OWNER), /* allowAnonymousAccess = */ true, apiKey ? { apiKey, domain } : undefined)
);
