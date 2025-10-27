import 'server-only';
import { env } from "@/env.mjs";
import { Prisma, PrismaClient } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";

// @see: https://authjs.dev/getting-started/adapters/prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// @NOTE: In almost all cases, the userScopedPrismaClientExtension should be used
// (since actions & queries are scoped to a particular user). There are some exceptions
// (e.g., in initialize.ts).
//
// @todo: we can mark this as `__unsafePrisma` in the future once we've migrated
// all of the actions & queries to use the userScopedPrismaClientExtension to avoid
// accidental misuse.
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/**
 * Creates a prisma client extension that scopes queries to striclty information
 * a given user should be able to access.
 */
export const userScopedPrismaClientExtension = (userId?: string) => {
    return Prisma.defineExtension(
        (prisma) => {
            return prisma.$extends({
                query: {
                    ...(env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' && hasEntitlement('permission-syncing') ? {
                        repo: {
                            async $allOperations({ args, query }) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const argsWithWhere = args as any;
                                argsWithWhere.where = {
                                    ...(argsWithWhere.where || {}),
                                    OR: [
                                        // Only include repos that are permitted to the user
                                        ...(userId ? [
                                            {
                                                permittedUsers: {
                                                    some: {
                                                        userId,
                                                    }
                                                }
                                            },
                                        ] : []),
                                        // or are public.
                                        {
                                            isPublic: true,
                                        }
                                    ]
                                }

                                return query(args);
                            }
                        }
                    } : {})
                }
            })
        })
}
