import { sew } from "@/middleware/sew";
import { createAudit } from "@/ee/features/audit/audit";
import { withOptionalAuth, type AuthPrincipal } from "@/middleware/withAuth";
import { PrismaClient } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { headers } from "next/headers";
import { QueryIR } from './ir';
import { parseQuerySyntaxIntoIR } from './parser';
import { SearchOptions } from "./types";
import { createZoektSearchRequest, type RepoSearchScope, zoektSearch, zoektStreamSearch } from './zoektSearcher';


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
    withOptionalAuth(async ({ prisma, user, org, principal }) => {
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

        const repoSearchScope = await getRepoSearchScope({ prisma, principal });

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
    withOptionalAuth(async ({ prisma, user, org, principal }) => {
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

        const repoSearchScope = await getRepoSearchScope({ prisma, principal });

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
 * Returns whether search can include all repositories or must be constrained to
 * the repositories exposed by the scoped Prisma client.
 */
const getRepoSearchScope = async ({
    prisma,
    principal,
}: {
    prisma: PrismaClient;
    principal?: AuthPrincipal;
}): Promise<RepoSearchScope> => {
    if (
        principal?.source !== 'scoped_access_token' &&
        (
            env.PERMISSION_SYNC_ENABLED !== 'true' ||
            !await hasEntitlement('permission-syncing')
        )
    ) {
        return { kind: 'all' };
    }

    const accessibleRepos = await prisma.repo.findMany({
        select: {
            name: true,
        }
    });
    return {
        kind: 'repos',
        repos: accessibleRepos.map(repo => repo.name),
    };
}
