import micromatch from "micromatch";
import { createLogger } from "@sourcebot/logger";
import { PrismaClient } from "@sourcebot/db";
import { getPlan, hasEntitlement } from "../entitlements.js";
import { SOURCEBOT_SUPPORT_EMAIL } from "../constants.js";
import { SearchContext } from "@sourcebot/schemas/v3/index.type";

const logger = createLogger('sync-search-contexts');

interface SyncSearchContextsParams {
    contexts?: { [key: string]: SearchContext } | undefined;
    orgId: number;
    db: PrismaClient;
}

export const syncSearchContexts = async (params: SyncSearchContextsParams) => {
    const { contexts, orgId, db } = params;

    if (!hasEntitlement("search-contexts")) {
        if (contexts) {
            const plan = getPlan();
            logger.warn(`Skipping search context sync. Reason: "Search contexts are not supported in your current plan: ${plan}. If you have a valid enterprise license key, pass it via SOURCEBOT_EE_LICENSE_KEY. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}."`);
        }
        return false;
    }

    if (contexts) {
        for (const [key, newContextConfig] of Object.entries(contexts)) {
            const allRepos = await db.repo.findMany({
                where: {
                    orgId,
                },
                select: {
                    id: true,
                    name: true,
                }
            });

            let newReposInContext = allRepos.filter(repo => {
                return micromatch.isMatch(repo.name, newContextConfig.include);
            });

            if (newContextConfig.exclude) {
                const exclude = newContextConfig.exclude;
                newReposInContext = newReposInContext.filter(repo => {
                    return !micromatch.isMatch(repo.name, exclude);
                });
            }

            const currentReposInContext = (await db.searchContext.findUnique({
                where: {
                    name_orgId: {
                        name: key,
                        orgId,
                    }
                },
                include: {
                    repos: true,
                }
            }))?.repos ?? [];

            await db.searchContext.upsert({
                where: {
                    name_orgId: {
                        name: key,
                        orgId,
                    }
                },
                update: {
                    repos: {
                        connect: newReposInContext.map(repo => ({
                            id: repo.id,
                        })),
                        disconnect: currentReposInContext
                            .filter(repo => !newReposInContext.map(r => r.id).includes(repo.id))
                            .map(repo => ({
                                id: repo.id,
                            })),
                    },
                    description: newContextConfig.description,
                },
                create: {
                    name: key,
                    description: newContextConfig.description,
                    org: {
                        connect: {
                            id: orgId,
                        }
                    },
                    repos: {
                        connect: newReposInContext.map(repo => ({
                            id: repo.id,
                        })),
                    }
                }
            });
        }
    }

    const deletedContexts = await db.searchContext.findMany({
        where: {
            name: {
                notIn: Object.keys(contexts ?? {}),
            },
            orgId,
        }
    });

    for (const context of deletedContexts) {
        logger.info(`Deleting search context with name '${context.name}'. ID: ${context.id}`);
        await db.searchContext.delete({
            where: {
                id: context.id,
            }
        })
    }

    return true;
}