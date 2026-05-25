import { z } from "zod";

export const changelogFeedIndexEntrySchema = z.object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1),
    publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    summary: z.string().min(1).optional(),
    path: z.string().min(1),
});

export const changelogFeedIndexSchema = z.object({
    schemaVersion: z.literal(1),
    entries: z.array(changelogFeedIndexEntrySchema),
});

export type ChangelogFeedIndex = z.infer<typeof changelogFeedIndexSchema>;
export type ChangelogFeedIndexEntry = z.infer<typeof changelogFeedIndexEntrySchema>;
