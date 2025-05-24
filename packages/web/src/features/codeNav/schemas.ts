import { rangeSchema, repositoryInfoSchema } from "../search/schemas";
import { z } from "zod";

export const findRelatedSymbolsResponseSchema = z.object({
    stats: z.object({
        matchCount: z.number(),
    }),
    files: z.array(z.object({
        fileName: z.string(),
        repository: z.string(),
        repositoryId: z.number(),
        webUrl: z.string().optional(),
        language: z.string(),
        matches: z.array(z.object({
            lineContent: z.string(),
            range: rangeSchema,
        }))
    })),
    repositoryInfo: z.array(repositoryInfoSchema),
});