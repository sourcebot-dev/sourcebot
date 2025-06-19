'use server';

import { sew, withAuth, withOrgMembership } from "@/actions";
import { OrgRole } from "@sourcebot/db";
import { prisma } from "@/prisma";
import { ServiceError } from "@/lib/serviceError";
import { AnalyticsResponse } from "./types";
import { subDays } from "date-fns";
import { getAuditService } from "@/ee/features/audit/factory";
import { hasEntitlement } from "@sourcebot/shared";
import { ErrorCode } from "@/lib/errorCodes";
import { StatusCodes } from "http-status-codes";

const auditService = getAuditService();

export const getAnalytics = async (domain: string, apiKey: string | undefined = undefined): Promise<AnalyticsResponse | ServiceError> => sew(() =>
  withAuth((userId, apiKeyHash) =>
    withOrgMembership(userId, domain, async ({ org }) => {
      if (!hasEntitlement("analytics")) {
        return {
          statusCode: StatusCodes.FORBIDDEN,
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: "Analytics is not available in your current plan",
        } satisfies ServiceError;
      }

      const endDate = new Date()
      const startDate = subDays(endDate, 30);

      const audits = await prisma.audit.findMany({
        where: {
          action: {
            in: [
              "user.performed_code_search",
              "user.performed_code_nav_find_references",
              "user.performed_code_nav_goto_definition",
            ]
          },
          timestamp: {
            gte: startDate,
            lte: endDate,
          }
        },
        select: {
          timestamp: true,
          actorId: true
        }
      })

      const dailyUserCounts = new Map<string, Set<string>>();
      audits.forEach(audit => {
        const dateKey = audit.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD format
        if (!dailyUserCounts.has(dateKey)) {
          dailyUserCounts.set(dateKey, new Set());
        }
        dailyUserCounts.get(dateKey)!.add(audit.actorId);
      });

      const result: AnalyticsResponse = Array.from(dailyUserCounts.entries()).map(([dateKey, userIds]) => ({
        date: new Date(dateKey),
        dau: userIds.size
      })).sort((a, b) => a.date.getTime() - b.date.getTime());

      await auditService.createAudit({
        action: 'analytics.fetch',
        actor: {
          id: apiKeyHash ?? userId,
          type: apiKeyHash ? 'api_key' : 'user'
        },
        target: {
          id: org.id.toString(),
          type: 'org'
        },
        orgId: org.id
      })

      return result;
    }, /* minRequiredRole = */ OrgRole.MEMBER), /* allowSingleTenantUnauthedAccess = */ true, apiKey ? { apiKey, domain } : undefined)
); 