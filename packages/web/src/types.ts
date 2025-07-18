import { Org } from "@sourcebot/db";
import { z } from "zod";

export const orgMetadataSchema = z.object({
    anonymousAccessEnabled: z.boolean().optional(),
})

export type OrgMetadata = z.infer<typeof orgMetadataSchema>;

export const getOrgMetadata = (org: Org): OrgMetadata | null => {
    const currentMetadata = orgMetadataSchema.safeParse(org.metadata);
    return currentMetadata.success ? currentMetadata.data : null;
}