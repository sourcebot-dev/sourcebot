import { IAuditService, AuditEvent } from '@/ee/features/audit/types';
import { Audit } from '@prisma/client';

export class MockAuditService implements IAuditService {
  async createAudit(_event: Omit<AuditEvent, 'sourcebotVersion'>): Promise<Audit | null> {
    return null;
  }
} 