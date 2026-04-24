import { sew } from "@/middleware/sew";
import { createAudit } from "@/ee/features/audit/audit";
import { getRepoPermissionFilterForUser } from "@/prisma";
import { withOptionalAuth } from "@/middleware/withAuth";
import { PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { headers } from "next/headers";
import { QueryIR } from './ir';
import { parseQuerySyntaxIntoIR } from './parser';
import { SearchOptions } from "./types";
import { createZoektSearchRequest, zoektSearch, zoektStreamSearch } from './zoektSearcher';


type QueryStringSearchRequest = {
    queryType: 'string';
    query: string;
    options: SearchOptions;
    source?: string;
}

type QueryIRSearchRequest = {
    queryType: 'ir';
    query: QueryIR;
    // Omit options that are specific to query syntax parsing.
    options: Omit<SearchOptions, 'isRegexEnabled' | 'isCaseSensitivityEnabled'>;
    source?: string;
}

type SearchRequest = QueryStringSearchRequest | QueryIRSearchRequest;

export const search = (request: SearchRequest) => sew(() =>
    withOptionalAuth(async ({ prisma, user, org }) => {
        if (user) {
            const source = request.source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            await createAudit({
                action: 'user.performed_code_search',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source },
            });
        }

        const repoSearchScope = await getAccessibleRepoNamesForUser({ user, prisma });

        // If needed, parse the query syntax into the query intermediate representation.
        const query = request.queryType === 'string' ? await parseQuerySyntaxIntoIR({
            query: request.query,
            options: request.options,
            prisma,
        }) : request.query;

        const zoektSearchRequest = await createZoektSearchRequest({
            query,
            options: request.options,
            repoSearchScope,
        });

        return zoektSearch(zoektSearchRequest, prisma);
    }));

export const streamSearch = (request: SearchRequest) => sew(() =>
    withOptionalAuth(async ({ prisma, user, org }) => {
        if (user) {
            const source = request.source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            await createAudit({
                action: 'user.performed_code_search',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source },
            });
        }

        const repoSearchScope = await getAccessibleRepoNamesForUser({ user, prisma });

        // If needed, parse the query syntax into the query intermediate representation.
        const query = request.queryType === 'string' ? await parseQuerySyntaxIntoIR({
            query: request.query,
            options: request.options,
            prisma,
        }) : request.query;

        const zoektSearchRequest = await createZoektSearchRequest({
            query,
            options: request.options,
            repoSearchScope,
        });

        return zoektStreamSearch(zoektSearchRequest, prisma);
    }));

/**
 * Returns a list of repository names that the user has access to.
 * If permission syncing is disabled, returns undefined.
 */
const getAccessibleRepoNamesForUser = async ({ user, prisma }: { user?: UserWithAccounts, prisma: PrismaClient }) => {
    if (
        env.PERMISSION_SYNC_ENABLED !== 'true' ||
        !await hasEntitlement('permission-syncing')
    ) {
        return undefined;
    }

    const accessibleRepos = await prisma.repo.findMany({
        where: getRepoPermissionFilterForUser(user),
        select: {
            name: true,
        }
    });
    return accessibleRepos.map(repo => repo.name);
}
