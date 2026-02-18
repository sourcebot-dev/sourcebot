import { z } from "zod";
import { Audit } from "@prisma/client";

export const auditActorSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "api_key"]),
})
export type AuditActor = z.infer<typeof auditActorSchema>;

export const auditTargetSchema = z.object({
  id: z.string(),
  type: z.enum(["user", "org", "file", "api_key", "account_join_request", "invite", "chat"]),
})
export type AuditTarget = z.infer<typeof auditTargetSchema>;

export const auditMetadataSchema = z.object({
    message: z.string().optional(),
    api_key: z.string().optional(),
    emails: z.string().optional(), // comma separated list of emails
})
export type AuditMetadata = z.infer<typeof auditMetadataSchema>;

export const auditEventSchema = z.object({
  action: z.string(),
  actor: auditActorSchema,
  target: auditTargetSchema,
  sourcebotVersion: z.string(),
  orgId: z.number(),
  metadata: auditMetadataSchema.optional()
})
export type AuditEvent = z.infer<typeof auditEventSchema>;

export interface IAuditService {
  createAudit(event: Omit<AuditEvent, 'sourcebotVersion'>): Promise<Audit | null>;
} 