import { Logger } from "winston";
import { AppContext } from "./types.js";
import path from 'path';
import { PrismaClient, Repo } from "@sourcebot/db";
import { decrypt } from "@sourcebot/crypto";
import { Token } from "@sourcebot/schemas/v3/shared.type";
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

export const getTokenFromConfig = async (token: Token, orgId: number, db?: PrismaClient) => {
    if (!db) {
        const e = new BackendException(BackendError.CONNECTION_SYNC_SYSTEM_ERROR, {
            message: `No database connection provided.`,
        });
        Sentry.captureException(e);
        throw e;
    }

    const secretKey = token.secret;
    const secret = await db.secret.findUnique({
        where: {
            orgId_key: {
                key: secretKey,
                orgId
            }
        }
    });

    if (!secret) {
        const e = new BackendException(BackendError.CONNECTION_SYNC_SECRET_DNE, {
            message: `Secret with key ${secretKey} not found for org ${orgId}`,
        });
        Sentry.captureException(e);
        throw e;
    }

    const decryptedSecret = decrypt(secret.iv, secret.encryptedValue);
    return {
        token: decryptedSecret,
        secretKey,
    };
}

export const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

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

export const getRepoPath = (repo: Repo, ctx: AppContext) => {
    return path.join(ctx.reposPath, repo.id.toString());
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