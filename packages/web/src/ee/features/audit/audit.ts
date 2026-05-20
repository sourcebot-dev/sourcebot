import { __unsafePrisma } from '@/prisma';
import { hasEntitlement } from '@/lib/entitlements';
import { env, createLogger, SOURCEBOT_VERSION } from '@sourcebot/shared';
import { AuditEvent } from '@/ee/features/audit/types';
import { Audit } from '@prisma/client';

const logger = createLogger('audit-service');

export async function createAudit(event: Omit<AuditEvent, 'sourcebotVersion'>): Promise<Audit | null> {
    const auditLogsEnabled = (env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === 'true') && await hasEntitlement("audit");
    if (!auditLogsEnabled) {
        return null;
    }

    try {
        const audit = await __unsafePrisma.audit.create({
            data: {
                action: event.action,
                actorId: event.actor.id,
                actorType: event.actor.type,
                targetId: event.target.id,
                targetType: event.target.type,
                sourcebotVersion: SOURCEBOT_VERSION,
                metadata: event.metadata,
                orgId: event.orgId,
            },
        });

        return audit;
    } catch (error) {
        logger.error(`Error creating audit event: ${error}`, { event });
        return null;
    }
}
