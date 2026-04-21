import { AgentConfig, AgentType, PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('resolve-agent-config');

/**
 * Resolves the most specific AgentConfig for a repository, using the following priority:
 *   1. REPO-scoped config matching the given repo
 *   2. CONNECTION-scoped config matching any connection the repo belongs to
 *   3. ORG-scoped config
 *
 * Returns null if no enabled config exists.
 */
export async function resolveAgentConfig(
    repoId: number,
    orgId: number,
    type: AgentType,
    prisma: PrismaClient,
): Promise<AgentConfig | null> {
    // 1. Repo-scoped
    const repoConfig = await prisma.agentConfig.findFirst({
        where: {
            orgId,
            type,
            enabled: true,
            scope: 'REPO',
            repos: {
                some: { repoId },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    if (repoConfig) {
        logger.debug(`Resolved REPO-scoped AgentConfig '${repoConfig.name}' for repo ${repoId}`);
        return repoConfig;
    }

    // 2. Connection-scoped (repo must belong to at least one of the config's connections)
    const connectionConfig = await prisma.agentConfig.findFirst({
        where: {
            orgId,
            type,
            enabled: true,
            scope: 'CONNECTION',
            connections: {
                some: {
                    connection: {
                        repos: {
                            some: { repoId },
                        },
                    },
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    if (connectionConfig) {
        logger.debug(`Resolved CONNECTION-scoped AgentConfig '${connectionConfig.name}' for repo ${repoId}`);
        return connectionConfig;
    }

    // 3. Org-wide
    const orgConfig = await prisma.agentConfig.findFirst({
        where: {
            orgId,
            type,
            enabled: true,
            scope: 'ORG',
        },
        orderBy: { updatedAt: 'desc' },
    });

    if (orgConfig) {
        logger.debug(`Resolved ORG-scoped AgentConfig '${orgConfig.name}' for repo ${repoId}`);
    } else {
        logger.debug(`No AgentConfig found for repo ${repoId}, using system defaults`);
    }

    return orgConfig;
}
