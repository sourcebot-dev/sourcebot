import { rangeSchema, repositoryInfoSchema } from "../search/schemas";
import { z } from "zod";

export const referenceSchema = z.object({
    fileName: z.string(),
    lineContent: z.string(),
    repository: z.string(),
    repositoryId: z.number(),
    webUrl: z.string().optional(),
    language: z.string(),
    matchRange: rangeSchema,
});

export const findSearchBasedSymbolReferencesResponseSchema = z.object({
    references: z.array(referenceSchema),
    repositoryInfo: z.array(repositoryInfoSchema),
});
