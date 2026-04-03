import 'server-only';
import { env, getDBConnectionString } from "@sourcebot/shared";
import { Prisma, PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";

// @see: https://authjs.dev/getting-started/adapters/prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const dbConnectionString = getDBConnectionString();

// @NOTE: In almost all cases, the userScopedPrismaClientExtension should be used
// (since actions & queries are scoped to a particular user). There are some exceptions
// (e.g., in initialize.ts).
//
// @todo: we can mark this as `__unsafePrisma` in the future once we've migrated
// all of the actions & queries to use the userScopedPrismaClientExtension to avoid
// accidental misuse.
export const prisma = globalForPrisma.prisma || new PrismaClient({
    // @note: this code is evaluated at build time, and will throw exceptions if these env vars are not set.
    // Here we explicitly check if the DATABASE_URL or the individual database variables are set, and only
    ...(dbConnectionString !== undefined ? {
        datasources: {
            db: {
                url: dbConnectionString,
            },
        }
    } : {}),
})
if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/**
 * Creates a prisma client extension that scopes queries to strictly information
 * a given user should be able to access.
 */
export const userScopedPrismaClientExtension = (user?: UserWithAccounts) => {
    return Prisma.defineExtension(
        (prisma) => {
            return prisma.$extends({
                query: {
                    ...(env.PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ? {
                        repo: {
                            async $allOperations({ args, query }) {
                                const argsWithWhere = args as Record<string, unknown> & {
                                    where?: Prisma.RepoWhereInput;
                                }

                                argsWithWhere.where = {
                                    ...(argsWithWhere.where || {}),
                                    ...getRepoPermissionFilterForUser(user),
                                };

                                return query(args);
                            }
                        }
                    } : {})
                }
            })
        })
}

/**
 * Returns a filter for repositories that the user has access to.
 */
export const getRepoPermissionFilterForUser = (user?: UserWithAccounts): Prisma.RepoWhereInput => {
    // Collect the issuer URLs from the user's linked accounts.
    // Used to grant access to public repos on connections with enforcePermissionsForPublicRepos: true.
    const linkedAccountIssuerUrls = (user?.accounts ?? [])
        .map(account => account.issuerUrl)
        .filter((url): url is string => url !== null && url !== undefined);

    // One of the following conditions must be met in order
    // for the user to be able to have access to the repo:
    return {
        OR: [
            // 1. The repo is explicitly permitted to the user
            // via the permittedAccounts relation.
            ...((user && user.accounts.length > 0) ? [
                {
                    permittedAccounts: {
                        some: {
                            accountId: {
                                in: user.accounts.map(account => account.id),
                            }
                        }
                    }
                },
            ] : []),
            // 2. The `enforcePermissions` flag is *not* set to `true` on any
            // of the repo's connections.
            {
                AND: [
                    { connections: { some: {} } }, // guard against vacuous truthiness
                    {
                        NOT: {
                            connections: {
                                some: {
                                    connection: {
                                        enforcePermissions: true,
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            // 3. The repo is public and either:
            //   - a. The `enforcePermissionsForPublicRepos` flag is *not* set to `true`
            //     on any of the repo's connections.
            //   - b. The user has a account linked to the same code host as the repo.
            {
                AND: [
                    { isPublic: true },
                    { connections: { some: {} } }, // guard against vacuous truthiness
                    {
                        OR: [
                            {
                                NOT: {
                                    connections: {
                                        some: {
                                            connection: { enforcePermissionsForPublicRepos: true }
                                        }
                                    }
                                }
                            },
                            ...(linkedAccountIssuerUrls.length > 0 ? [{
                                external_codeHostUrl: {
                                    in: linkedAccountIssuerUrls
                                }
                            }] : []),
                        ]
                    }
                ]
            },
        ]
    }
}
