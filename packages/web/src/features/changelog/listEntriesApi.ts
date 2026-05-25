import { sew } from "@/middleware/sew";
import { withOptionalAuth } from "@/middleware/withAuth";
import { env } from "@sourcebot/shared";

export type ChangelogEntryDto = {
    slug: string;
    title: string;
    publishedAt: string;
    summary: string;
    version: string;
    bodyMarkdown: string;
};

export type ListChangelogEntriesResponse = {
    entries: ChangelogEntryDto[];
    /// Base URL used to resolve relative media references in `bodyMarkdown`
    /// (e.g. `../media/<slug>/foo.png`). Derived from CHANGELOG_FEED_URL.
    entriesBaseUrl: string;
};

export const listChangelogEntries = async () =>
    sew(() =>
        withOptionalAuth(async ({ prisma }) => {
            const entries = await prisma.changelogEntry.findMany({
                orderBy: { publishedAt: "desc" },
            });

            const entriesBaseUrl = new URL("entries/", env.CHANGELOG_FEED_URL).toString();

            const result: ListChangelogEntriesResponse = {
                entries: entries.map((entry) => ({
                    slug: entry.slug,
                    title: entry.title,
                    publishedAt: entry.publishedAt.toISOString(),
                    summary: entry.summary,
                    version: entry.version,
                    bodyMarkdown: entry.bodyMarkdown,
                })),
                entriesBaseUrl,
            };
            return result;
        })
    );
