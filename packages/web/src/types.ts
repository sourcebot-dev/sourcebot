import { z } from "zod";

export const orgMetadataSchema = z.object({
    anonymousAccessEnabled: z.boolean().optional(),
})

export const demoSearchContextSchema = z.object({
    id: z.number(),
    displayName: z.string(),
    value: z.string(),
    type: z.enum(["repo", "set"]),
    codeHostType: z.string().optional(),
})

export const demoSearchExampleSchema = z.object({
    title: z.string(),
    description: z.string(),
    url: z.string(),
    searchContext: z.array(z.number())
})

export const demoSearchContextExampleSchema = z.object({
    searchContext: z.number(),
    description: z.string(),
})

export const demoExamplesSchema = z.object({
    searchContexts: demoSearchContextSchema.array(),
    searchExamples: demoSearchExampleSchema.array(),
    searchContextExamples: demoSearchContextExampleSchema.array(),
})

export type OrgMetadata = z.infer<typeof orgMetadataSchema>;
export type DemoExamples = z.infer<typeof demoExamplesSchema>;
export type DemoSearchContext = z.infer<typeof demoSearchContextSchema>;
export type DemoSearchExample = z.infer<typeof demoSearchExampleSchema>;
export type DemoSearchContextExample = z.infer<typeof demoSearchContextExampleSchema>;