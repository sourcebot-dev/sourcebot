import { PrismaClient } from "@sourcebot/db";
import { CachedPermittedExternalAccounts, cachedPermittedExternalAccountsSchema, createLogger } from "@sourcebot/shared";

const logger = createLogger('permission-utils');

/**
 * Rebuilds the AccountToRepoPermission join table for a given account
 * based on the cached external account IDs stored in repos.
 *
 * This is useful when a new account is created and we want to grant
 * access to repos without waiting for a full permission sync.
 *
 * @param db - Prisma client instance
 * @param accountId - The internal account ID
 * @param provider - The OAuth provider (e.g., 'github', 'gitlab')
 * @param providerAccountId - The external account ID from the provider
 */
export async function rebuildPermissionsFromCache(
    db: PrismaClient,
    accountId: string,
    provider: string,
    providerAccountId: string
): Promise<void> {
    logger.info(`Rebuilding permissions from cache for account ${accountId} (${provider}:${providerAccountId})`);

    // Find all repos that have this external account ID in their cached permissions
    const repos = await db.repo.findMany({
        where: {
            cachedPermittedExternalAccounts: {
                not: null,
            },
        },
        select: {
            id: true,
            cachedPermittedExternalAccounts: true,
        },
    });

    // Filter repos that include this specific external account ID for this provider
    const reposWithAccess = repos.filter(repo => {
        try {
            const cached = cachedPermittedExternalAccountsSchema.parse(
                repo.cachedPermittedExternalAccounts
            );

            const providerAccountIds = cached[provider as keyof CachedPermittedExternalAccounts];
            return providerAccountIds?.includes(providerAccountId) ?? false;
        } catch (error) {
            logger.warn(`Failed to parse cachedPermittedExternalAccounts for repo ${repo.id}:`, error);
            return false;
        }
    });

    if (reposWithAccess.length === 0) {
        logger.info(`No repos found with cached permissions for account ${accountId}`);
        return;
    }

    // Create AccountToRepoPermission entries
    await db.accountToRepoPermission.createMany({
        data: reposWithAccess.map(repo => ({
            accountId,
            repoId: repo.id,
        })),
        skipDuplicates: true,
    });

    logger.info(`Rebuilt permissions for ${reposWithAccess.length} repos for account ${accountId}`);
}

/**
 * Synchronizes permissions for all existing accounts based on cached external account IDs.
 *
 * This can be used as a migration script or maintenance task to ensure the join table
 * is in sync with the cached data.
 *
 * @param db - Prisma client instance
 */
export async function syncAllPermissionsFromCache(db: PrismaClient): Promise<void> {
    logger.info('Starting full permission sync from cache');

    const accounts = await db.account.findMany({
        select: {
            id: true,
            provider: true,
            providerAccountId: true,
        },
    });

    let totalUpdated = 0;

    for (const account of accounts) {
        try {
            await rebuildPermissionsFromCache(
                db,
                account.id,
                account.provider,
                account.providerAccountId
            );
            totalUpdated++;
        } catch (error) {
            logger.error(`Failed to rebuild permissions for account ${account.id}:`, error);
        }
    }

    logger.info(`Completed full permission sync from cache. Updated ${totalUpdated}/${accounts.length} accounts`);
}
