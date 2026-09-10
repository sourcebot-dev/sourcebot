import { z } from "zod";
import { repositoryDiscoveryIssueSchema } from "./repositoryDiscovery.js";

export const connectionSyncResultSchema = z.discriminatedUnion("outcome", [
    z.object({
        outcome: z.literal("SUCCESS"),
    }),
    z.object({
        outcome: z.literal("PARTIAL_SUCCESS"),
        reasons: z.array(repositoryDiscoveryIssueSchema).min(1),
    }),
]);

export type ConnectionSyncResult = z.infer<
    typeof connectionSyncResultSchema
>;
