import { z } from "zod";

export const orgMetadataSchema = z.object({
    anonymousAccessEnabled: z.boolean().optional(),
})

export const demoSearchScopeSchema = z.object({
    id: z.number(),
    displayName: z.string(),
    value: z.string(),
    type: z.enum(["repo", "reposet"]),
    codeHostType: z.string().optional(),
})

export const demoSearchExampleSchema = z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    searchScopes: z.array(z.number())
})

export const demoExamplesSchema = z.object({
    searchScopes: demoSearchScopeSchema.array(),
    searchExamples: demoSearchExampleSchema.array(),
})

export type OrgMetadata = z.infer<typeof orgMetadataSchema>;
export type DemoExamples = z.infer<typeof demoExamplesSchema>;
export type DemoSearchScope = z.infer<typeof demoSearchScopeSchema>;
export type DemoSearchExample = z.infer<typeof demoSearchExampleSchema>;