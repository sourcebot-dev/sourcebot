import { IAuditService, AuditEvent } from '@/ee/features/audit/types';
import { prisma } from '@/prisma';
import { Audit } from '@prisma/client';

export class AuditService implements IAuditService {
  async createAudit(event: Omit<AuditEvent, 'sourcebotVersion'>): Promise<Audit | null> {
    const sourcebotVersion = process.env.NEXT_PUBLIC_SOURCEBOT_VERSION || 'unknown';
    const audit = await prisma.audit.create({
      data: {
        action: event.action,
        actorId: event.actor.id,
        actorType: event.actor.type,
        targetId: event.target.id,
        targetType: event.target.type,
        sourcebotVersion,
        metadata: event.metadata,
      },
    });

    return audit;
  }
}