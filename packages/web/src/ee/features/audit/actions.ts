"use server";

import { sew } from "@/middleware/sew";
import { getAuditService } from "@/ee/features/audit/factory";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { createLogger } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { AuditEvent } from "./types";
import { OrgRole } from "@sourcebot/db";

const auditService = getAuditService();
const logger = createLogger('audit-utils');

export const createAuditAction = async (event: Omit<AuditEvent, 'sourcebotVersion' | 'orgId' | 'actor' | 'target'>) => sew(async () =>
    withAuth(async ({ user, org }) => {
        await auditService.createAudit({
            ...event,
            orgId: org.id,
            actor: { id: user.id, type: "user" },
            target: { id: org.id.toString(), type: "org" },
        })
    })
);

export interface FetchAuditRecordsParams {
    skip: number;
    take: number;
    since?: Date;
    until?: Date;
}

export const fetchAuditRecords = async (params: FetchAuditRecordsParams) => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const where = {
                    orgId: org.id,
                    ...(params.since || params.until ? {
                        timestamp: {
                            ...(params.since ? { gte: params.since } : {}),
                            ...(params.until ? { lte: params.until } : {}),
                        }
                    } : {}),
                };

                const [auditRecords, totalCount] = await Promise.all([
                    prisma.audit.findMany({
                        where,
                        orderBy: [
                            { timestamp: 'desc' },
                            { id: 'desc' },
                        ],
                        skip: params.skip,
                        take: params.take,
                    }),
                    prisma.audit.count({ where }),
                ]);

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

                return { auditRecords, totalCount };
            } catch (error) {
                logger.error('Error fetching audit logs', { error });
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.UNEXPECTED_ERROR,
                    message: "Failed to fetch audit logs",
                } satisfies ServiceError;
            }
        }))
);
