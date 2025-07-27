import { z } from "zod";

export const orgMetadataSchema = z.object({
    anonymousAccessEnabled: z.boolean().optional(),
})

export const demoSearchExampleSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.string(),
})

export const demoSearchContextExampleSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
})

export const demoExamplesSchema = z.object({
    searchExamples: demoSearchExampleSchema.array(),
    searchContexts: demoSearchContextExampleSchema.array(),
})

export type OrgMetadata = z.infer<typeof orgMetadataSchema>;
export type DemoExamples = z.infer<typeof demoExamplesSchema>;
export type DemoSearchExample = z.infer<typeof demoSearchExampleSchema>;
export type DemoSearchContextExample = z.infer<typeof demoSearchContextExampleSchema>;