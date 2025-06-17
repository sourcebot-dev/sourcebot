import { Logger } from "winston";
import { AppContext } from "./types.js";
import path from 'path';
import { PrismaClient, Repo } from "@sourcebot/db";
import { getTokenFromConfig as getTokenFromConfigBase } from "@sourcebot/crypto";
import { BackendException, BackendError } from "@sourcebot/error";
import * as Sentry from "@sentry/node";

export const measure = async <T>(cb: () => Promise<T>) => {
    const start = Date.now();
    const data = await cb();
    const durationMs = Date.now() - start;
    return {
        data,
        durationMs
    }
}

export const marshalBool = (value?: boolean) => {
    return !!value ? '1' : '0';
}

export const getTokenFromConfig = async (token: any, orgId: number, db: PrismaClient, logger?: Logger) => {
    try {
        return await getTokenFromConfigBase(token, orgId, db);
    } catch (error: unknown) {
        if (error instanceof Error) {
            const e = new BackendException(BackendError.CONNECTION_SYNC_SECRET_DNE, {
                message: error.message,
            });
            Sentry.captureException(e);
            logger?.error(error.message);
            throw e;
        }
        throw error;
    }
};

export const resolvePathRelativeToConfig = (localPath: string, configPath: string) => {
    let absolutePath = localPath;
    if (!path.isAbsolute(absolutePath)) {
        if (absolutePath.startsWith('~')) {
            absolutePath = path.join(process.env.HOME ?? '', absolutePath.slice(1));
        }

        absolutePath = path.resolve(path.dirname(configPath), absolutePath);
    }

    return absolutePath;
}

export const arraysEqualShallow = <T>(a?: readonly T[], b?: readonly T[]) => {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    if (a.length !== b.length) return false;

    const aSorted = a.toSorted();
    const bSorted = b.toSorted();

    for (let i = 0; i < aSorted.length; i++) {
        if (aSorted[i] !== bSorted[i]) {
            return false;
        }
    }

    return true;
}

// @note: this function is duplicated in `packages/web/src/features/fileTree/actions.ts`.
// @todo: we should move this to a shared package.
export const getRepoPath = (repo: Repo, ctx: AppContext): { path: string, isReadOnly: boolean } => {
    // If we are dealing with a local repository, then use that as the path.
    // Mark as read-only since we aren't guaranteed to have write access to the local filesystem.
    const cloneUrl = new URL(repo.cloneUrl);
    if (repo.external_codeHostType === 'generic-git-host' && cloneUrl.protocol === 'file:') {
        return {
            path: cloneUrl.pathname,
            isReadOnly: true,
        }
    }

    return {
        path: path.join(ctx.reposPath, repo.id.toString()),
        isReadOnly: false,
    }
}

export const getShardPrefix = (orgId: number, repoId: number) => {
    return `${orgId}_${repoId}`;
}

export const fetchWithRetry = async <T>(
    fetchFn: () => Promise<T>,
    identifier: string,
    logger: Logger,
    maxAttempts: number = 3
): Promise<T> => {
    let attempts = 0;

    while (true) {
        try {
            return await fetchFn();
        } catch (e: any) {
            Sentry.captureException(e);

            attempts++;
            if ((e.status === 403 || e.status === 429 || e.status === 443) && attempts < maxAttempts) {
                const computedWaitTime = 3000 * Math.pow(2, attempts - 1);
                const resetTime = e.response?.headers?.['x-ratelimit-reset'] ? parseInt(e.response.headers['x-ratelimit-reset']) * 1000 : Date.now() + computedWaitTime;
                const waitTime = resetTime - Date.now();
                logger.warn(`Rate limit exceeded for ${identifier}. Waiting ${waitTime}ms before retry ${attempts}/${maxAttempts}...`);

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw e;
        }
    }
}