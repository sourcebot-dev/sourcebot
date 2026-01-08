import { IAuditService } from '@/ee/features/audit/types';
import { MockAuditService } from '@/ee/features/audit/mockAuditService';
import { AuditService } from '@/ee/features/audit/auditService';
import { hasEntitlement } from '@sourcebot/shared';
import { env } from '@sourcebot/shared';

let enterpriseService: IAuditService | undefined;

export function getAuditService(): IAuditService {
  const auditLogsEnabled = (env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === 'true') && hasEntitlement("audit");
  enterpriseService = enterpriseService ?? (auditLogsEnabled ? new AuditService() : new MockAuditService());
  return enterpriseService;
}