import { __unsafePrisma } from "@/prisma";
import { createLogger, env } from "@sourcebot/shared";
import { changelogFeedIndexSchema, type ChangelogFeedIndexEntry } from "./types";

const logger = createLogger("changelog");

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 10 * 1000;

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

const stripFrontmatter = (markdown: string): string => markdown.replace(FRONTMATTER_RE, "").trimStart();

const fetchWithTimeout = async (url: string): Promise<Response> => {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
        throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
    }
    return response;
};

const upsertEntry = async (entry: ChangelogFeedIndexEntry, baseUrl: string): Promise<void> => {
    const bodyUrl = new URL(entry.path, baseUrl).toString();
    const response = await fetchWithTimeout(bodyUrl);
    const rawMarkdown = await response.text();
    const bodyMarkdown = stripFrontmatter(rawMarkdown);

    const data = {
        slug: entry.slug,
        title: entry.title,
        publishedAt: new Date(entry.publishedAt),
        summary: entry.summary,
        version: entry.version,
        bodyMarkdown,
    };

    await __unsafePrisma.changelogEntry.upsert({
        where: { slug: entry.slug },
        create: data,
        update: data,
    });
};

export const pollChangelog = async (): Promise<void> => {
    if (env.CHANGELOG_ENABLED !== "true") {
        return;
    }

    const feedUrl = env.CHANGELOG_FEED_URL;

    let parsedIndex;
    try {
        const response = await fetchWithTimeout(feedUrl);
        const json = await response.json();
        parsedIndex = changelogFeedIndexSchema.parse(json);
    } catch (err) {
        // Network or parse failure — keep serving whatever is cached.
        logger.warn(`Failed to fetch changelog index from ${feedUrl}: ${err instanceof Error ? err.message : String(err)}`);
        return;
    }

    let upserted = 0;
    for (const entry of parsedIndex.entries) {
        try {
            await upsertEntry(entry, feedUrl);
            upserted++;
        } catch (err) {
            logger.warn(`Failed to upsert changelog entry '${entry.slug}': ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    logger.debug(`Changelog poll complete: ${upserted}/${parsedIndex.entries.length} entries upserted`);
};

export const startChangelogPollingJob = (): void => {
    if (env.CHANGELOG_ENABLED !== "true") {
        logger.info("Changelog feed disabled via CHANGELOG_ENABLED — skipping poll job");
        return;
    }
    pollChangelog().catch(() => { /* logged inside */ });
    setInterval(() => {
        pollChangelog().catch(() => { /* logged inside */ });
    }, POLL_INTERVAL_MS);
};
