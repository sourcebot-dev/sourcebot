import { IAuditService, AuditEvent } from '@/ee/features/audit/types';
import { prisma } from '@/prisma';
import { Audit } from '@prisma/client';
import { createLogger, SOURCEBOT_VERSION } from '@sourcebot/shared';

const logger = createLogger('audit-service');

export class AuditService implements IAuditService {
  async createAudit(event: Omit<AuditEvent, 'sourcebotVersion'>): Promise<Audit | null> {
    const sourcebotVersion = SOURCEBOT_VERSION;

    try {
      const audit = await prisma.audit.create({
        data: {
          action: event.action,
          actorId: event.actor.id,
          actorType: event.actor.type,
          targetId: event.target.id,
          targetType: event.target.type,
          sourcebotVersion,
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
}