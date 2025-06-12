import { z } from "zod";

export const auditActorSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "system"]),
})
export type AuditActor = z.infer<typeof auditActorSchema>;

export const auditTargetSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "system"]),
})
export type AuditTarget = z.infer<typeof auditTargetSchema>;

export const auditEventSchema = z.object({
  action: z.string(),
  timestamp: z.date(),
  actor: auditActorSchema,
  target: auditTargetSchema,
  sourcebotVersion: z.string()
})
export type AuditEvent = z.infer<typeof auditEventSchema>;

export interface IAuditService {
  createAudit(event: Omit<AuditEvent, 'timestamp' | 'sourcebotVersion'>): Promise<AuditEvent | null>;
} 