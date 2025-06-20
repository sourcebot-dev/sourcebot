/**
 * Utility functions for batched Repo queries to handle large datasets efficiently
 * and prevent memory issues like "Failed to convert rust String into napi string"
 * 
 * This is a workaround for the Prisma issue: https://github.com/prisma/prisma/issues/13864
 * 
 * The batch size can be configured via the DB_QUERY_BATCH_SIZE environment variable
 * or the dbQueryBatchSize setting in the configuration file.
 */

import { Repo } from "@sourcebot/db";
import { prisma } from "@/prisma";
import { env } from "@/env.mjs";

const DEFAULT_BATCH_SIZE = env.DB_QUERY_BATCH_SIZE;

/**
 * Fetches repos by IDs in batches to prevent memory issues
 * @param ids - Array of repo IDs to fetch
 * @param orgId - Organization ID to filter by
 * @param batchSize - Size of each batch (default: 500)
 * @returns Array of repos
 */
export async function batchedFindReposByIds(
    ids: number[],
    orgId: number,
    batchSize: number = DEFAULT_BATCH_SIZE
): Promise<Repo[]> {
    if (ids.length === 0) {
        return [];
    }

    const results: Repo[] = [];
    const totalBatches = Math.ceil(ids.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * batchSize;
        const endIndex = Math.min(startIndex + batchSize, ids.length);
        const batchIds = ids.slice(startIndex, endIndex);

        const batchResults = await prisma.repo.findMany({
            where: {
                id: { in: batchIds },
                orgId,
            }
        });
        results.push(...batchResults);
    }

    return results;
}

/**
 * Fetches repos by names in batches to prevent memory issues
 * @param names - Array of repo names to fetch
 * @param orgId - Organization ID to filter by
 * @param batchSize - Size of each batch (default: 500)
 * @returns Array of repos
 */
export async function batchedFindReposByNames(
    names: string[],
    orgId: number,
    batchSize: number = DEFAULT_BATCH_SIZE
): Promise<Repo[]> {
    if (names.length === 0) {
        return [];
    }

    const results: Repo[] = [];
    const totalBatches = Math.ceil(names.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const startIndex = i * batchSize;
        const endIndex = Math.min(startIndex + batchSize, names.length);
        const batchNames = names.slice(startIndex, endIndex);

        const batchResults = await prisma.repo.findMany({
            where: {
                name: { in: batchNames },
                orgId,
            }
        });
        results.push(...batchResults);
    }

    return results;
} 