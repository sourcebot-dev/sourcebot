import { IAuditService } from '@/ee/features/audit/types';
import { MockAuditService } from '@/ee/features/audit/mockAuditService';
import { hasEntitlement } from '@/features/entitlements/server';
import { AuditService } from '@/ee/features/audit/auditService';

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