import { env } from "@/env.mjs";
import { getPlan, hasEntitlement } from "@/features/entitlements/server";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { SearchContext } from "@sourcebot/schemas/v3/index.type";
import micromatch from "micromatch";

export const syncSearchContexts = async (contexts?: { [key: string]: SearchContext }) => {
    if (env.SOURCEBOT_TENANCY_MODE !== 'single') {
        throw new Error("Search contexts are not supported in this tenancy mode. Set SOURCEBOT_TENANCY_MODE=single in your environment variables.");
    }

    if (!hasEntitlement("search-contexts")) {
        if (contexts) {
            const plan = getPlan();
            console.error(`Search contexts are not supported in your current plan: ${plan}. If you have a valid enterprise license key, pass it via SOURCEBOT_EE_LICENSE_KEY. For support, contact team@sourcebot.dev.`);
        }
        return;
    }

    if (contexts) {
        for (const [key, newContextConfig] of Object.entries(contexts)) {
            const allRepos = await prisma.repo.findMany({
                where: {
                    orgId: SINGLE_TENANT_ORG_ID,
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

            const currentReposInContext = (await prisma.searchContext.findUnique({
                where: {
                    name_orgId: {
                        name: key,
                        orgId: SINGLE_TENANT_ORG_ID,
                    }
                },
                include: {
                    repos: true,
                }
            }))?.repos ?? [];

            await prisma.searchContext.upsert({
                where: {
                    name_orgId: {
                        name: key,
                        orgId: SINGLE_TENANT_ORG_ID,
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
                            id: SINGLE_TENANT_ORG_ID,
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

    const deletedContexts = await prisma.searchContext.findMany({
        where: {
            name: {
                notIn: Object.keys(contexts ?? {}),
            },
            orgId: SINGLE_TENANT_ORG_ID,
        }
    });

    for (const context of deletedContexts) {
        console.log(`Deleting search context with name '${context.name}'. ID: ${context.id}`);
        await prisma.searchContext.delete({
            where: {
                id: context.id,
            }
        })
    }
}