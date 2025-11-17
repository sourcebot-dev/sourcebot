import { z } from "zod";
import { rangeSchema, repositoryInfoSchema } from "../search/schemas";

export const findRelatedSymbolsRequestSchema = z.object({
    symbolName: z.string(),
    language: z.string(),
    revisionName: z.string().optional(),
});
export type FindRelatedSymbolsRequest = z.infer<typeof findRelatedSymbolsRequestSchema>;

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

export type FindRelatedSymbolsResponse = z.infer<typeof findRelatedSymbolsResponseSchema>;
