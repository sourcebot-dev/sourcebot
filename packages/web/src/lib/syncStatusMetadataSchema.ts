import { z } from "zod";

export const NotFoundSchema = z.object({
  users: z.array(z.string()),
  orgs: z.array(z.string()),
  repos: z.array(z.string()),
});

export const SyncStatusMetadataSchema = z.object({
  notFound: NotFoundSchema.optional(),
  error: z.string().optional(),
  secretKey: z.string().optional(),
  status: z.number().optional(),
});

export type NotFoundData = z.infer<typeof NotFoundSchema>;
export type SyncStatusMetadata = z.infer<typeof SyncStatusMetadataSchema>;