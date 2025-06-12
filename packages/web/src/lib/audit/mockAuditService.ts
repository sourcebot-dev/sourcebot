import { IAuditService, AuditEvent } from './types.js';

export class MockAuditService implements IAuditService {
  async createAudit(event: Omit<AuditEvent, 'timestamp' | 'sourcebotVersion'>): Promise<AuditEvent | null> {
    return null;
  }
} 