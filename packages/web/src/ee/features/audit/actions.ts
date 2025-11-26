"use server";

import { sew } from "@/actions";
import { getAuditService } from "@/ee/features/audit/factory";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { withAuthV2 } from "@/withAuthV2";
import { createLogger } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { AuditEvent } from "./types";

const auditService = getAuditService();
const logger = createLogger('audit-utils');

export const createAuditAction = async (event: Omit<AuditEvent, 'sourcebotVersion' | 'orgId' | 'actor' | 'target'>) => sew(async () =>
    withAuthV2(async ({ user, org }) => {
        await auditService.createAudit({
            ...event,
            orgId: org.id,
            actor: { id: user.id, type: "user" },
            target: { id: org.id.toString(), type: "org" },
        })
    })
);

export const fetchAuditRecords = async () => sew(() =>
    withAuthV2(async ({ user, org }) => {
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
);
