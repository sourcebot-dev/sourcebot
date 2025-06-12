import { IAuditService } from './types.js';
import { MockAuditService } from './mockAuditService.js';
import { hasEntitlement } from '@/features/entitlements/server.js';
import { AuditService } from '@/ee/features/audit/auditService.js';

let enterpriseService: IAuditService | null = null;

export function getAuditService(): IAuditService {
  if (hasEntitlement('audit')) {
    if (!enterpriseService) {
      enterpriseService = new AuditService();
    }
    return enterpriseService!;
  }
  return new MockAuditService();
}

export * from './types.js'; 