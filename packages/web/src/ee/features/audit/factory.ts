import { IAuditService } from '@/ee/features/audit/types';
import { MockAuditService } from '@/ee/features/audit/mockAuditService';
import { AuditService } from '@/ee/features/audit/auditService';
import { env } from '@/env.mjs';

let enterpriseService: IAuditService | undefined;

export function getAuditService(): IAuditService {
  enterpriseService = enterpriseService ?? (env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === 'true' ? new AuditService() : new MockAuditService());
  return enterpriseService;
}