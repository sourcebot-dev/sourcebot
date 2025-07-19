import { z } from "zod";

export const orgMetadataSchema = z.object({
    anonymousAccessEnabled: z.boolean().optional(),
})

export type OrgMetadata = z.infer<typeof orgMetadataSchema>;