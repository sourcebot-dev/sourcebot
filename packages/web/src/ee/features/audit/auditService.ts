import { IAuditService, AuditEvent } from '../../../lib/audit/types.js';

export class AuditService implements IAuditService {
  async createAudit(event: Omit<AuditEvent, 'timestamp' | 'sourcebotVersion'>): Promise<AuditEvent | null> {
    return null;
  }
} 