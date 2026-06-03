'use server';

import { cookies } from 'next/headers';
import { DISMISS_COOKIE_PREFIX, type BannerId } from './types';
import { compareVersions, formatVersion, parseVersion } from "@sourcebot/shared/client";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger("banner-actions");

// eslint-disable-next-line authz/require-auth-wrapper
export async function dismissBanner(id: BannerId) {
    const cookieStore = await cookies();
    const today = new Date().toISOString().slice(0, 10);
    cookieStore.set(`${DISMISS_COOKIE_PREFIX}${id}`, today, {
        maxAge: 60 * 60 * 25,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
    });
}


const GITHUB_TAGS_URL = "https://api.github.com/repos/sourcebot-dev/sourcebot/tags";
const REVALIDATE_SECONDS = 60 * 60;

// Returns the highest semver tag from the sourcebot GitHub repo, or null if
// the fetch fails (rate-limited, offline server, slow GitHub, etc). Cached
// at the Next fetch layer so we don't hit GitHub on every page render.
// eslint-disable-next-line authz/require-auth-wrapper -- this pulls from the public GitHub and does not touch any sensitive data.
export async function tryGetLatestSourcebotTag({ timeoutMs }: { timeoutMs: number }): Promise<string | null> {
    try {
        const response = await fetch(GITHUB_TAGS_URL, {
            cache: 'force-cache',
            next: { revalidate: REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
            logger.warn(`Failed to fetch Sourcebot version information. Status code: ${response.status}, status text: ${response.statusText}`);
            return null;
        }
        const data = (await response.json()) as { name: string }[];
        const versions = data
            .map(({ name }) => parseVersion(name))
            .filter((v): v is NonNullable<ReturnType<typeof parseVersion>> => v !== null)
            .sort((a, b) => compareVersions(a, b));
        const latest = versions[versions.length - 1];
        return latest ? formatVersion(latest) : null;
    } catch {
        return null;
    }
}
