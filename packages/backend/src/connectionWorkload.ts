import { QueueSpec, Workload } from "./types.js";
import { prisma } from "./prisma.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/index.type";
import { compileAzureDevOpsConfig, compileBitbucketConfig, compileGenericGitHostConfig, compileGerritConfig, compileGiteaConfig, compileGithubConfig, compileGitlabConfig } from "./repoCompileUtils.js";
import { createLogger, env, loadConfig } from "@sourcebot/shared";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import * as Sentry from "@sentry/node";


const connectionQueueSpec: QueueSpec<'connection'> = {
    name: 'connection',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 }
    },
    dedupKey: (data) => `connection:${data.connectionId}`
}

// @todo
const logger = createLogger('connection-workflow');

export const connectionWorkload: Workload<'connection'> = {
    spec: connectionQueueSpec,
    concurrency: 2,
    process: async ({
        data: {
            connectionId,
            orgId
        },
        signal,
    }) => {
        const connection = await prisma.connection.findUniqueOrThrow({
            where: {
                id: connectionId
            }
        });

        const config = connection.config as unknown as ConnectionConfig;

        const result = await (async () => {
            switch (config.type) {
                case 'github': {
                    return await compileGithubConfig(config, connectionId, signal);
                }
                case 'gitlab': {
                    return await compileGitlabConfig(config, connectionId);
                }
                case 'gitea': {
                    return await compileGiteaConfig(config, connectionId);
                }
                case 'gerrit': {
                    return await compileGerritConfig(config, connectionId);
                }
                case 'bitbucket': {
                    return await compileBitbucketConfig(config, connectionId);
                }
                case 'azuredevops': {
                    return await compileAzureDevOpsConfig(config, connectionId);
                }
                case 'git': {
                    return await compileGenericGitHostConfig(config, connectionId);
                }
            }
        })();

        let { repoData } = result;

        // Filter out any duplicates by external_id and external_codeHostUrl.
        repoData = repoData.filter((repo, index, self) => {
            return index === self.findIndex(r =>
                r.external_id === repo.external_id &&
                r.external_codeHostUrl === repo.external_codeHostUrl
            );
        })

        // @note: to handle orphaned Repos we delete all RepoToConnection records for this connection,
        // and then recreate them when we upsert the repos. For example, if a repo is no-longer
        // captured by the connection's config (e.g., it was deleted, marked archived, etc.), it won't
        // appear in the repoData array above, and so the RepoToConnection record won't be re-created.
        // Repos that have no RepoToConnection records are considered orphaned and can be deleted.
        await prisma.$transaction(async (tx) => {
            const deleteStart = performance.now();
            await tx.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    repos: {
                        deleteMany: {}
                    }
                }
            });
            const deleteDuration = performance.now() - deleteStart;
            logger.debug(`Deleted all RepoToConnection records for connection ${connection.name} (id: ${connectionId}) in ${deleteDuration}ms`);

            const totalUpsertStart = performance.now();
            for (const repo of repoData) {
                const upsertStart = performance.now();
                await tx.repo.upsert({
                    where: {
                        external_id_external_codeHostUrl_orgId: {
                            external_id: repo.external_id,
                            external_codeHostUrl: repo.external_codeHostUrl,
                            orgId: orgId,
                        }
                    },
                    update: repo,
                    create: repo,
                })
                const upsertDuration = performance.now() - upsertStart;
                logger.debug(`Upserted repo ${repo.displayName} (id: ${repo.external_id}) in ${upsertDuration}ms`);
            }
            const totalUpsertDuration = performance.now() - totalUpsertStart;
            logger.debug(`Upserted ${repoData.length} repos for connection ${connection.name} (id: ${connectionId}) in ${totalUpsertDuration}ms`);
        }, { timeout: env.CONNECTION_MANAGER_UPSERT_TIMEOUT_MS });

        await prisma.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncedAt: new Date(),
            }
        });

        // After a connection has synced, we need to re-sync the org's search contexts as
        // there may be new repos that match the search context's include/exclude patterns.
        try {
            const config = await loadConfig(env.CONFIG_PATH);

            await syncSearchContexts({
                orgId,
                contexts: config.contexts,
            });
        } catch (err) {
            logger.error(`Failed to sync search contexts for connection ${connectionId}: ${err}`);
            Sentry.captureException(err);
        }
    }
}
