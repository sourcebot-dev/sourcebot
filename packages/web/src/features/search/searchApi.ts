import { sew } from "@/actions";
import { getAuditService } from "@/ee/features/audit/factory";
import { getRepoPermissionFilterForUser } from "@/prisma";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { env, hasEntitlement } from "@sourcebot/shared";
import { headers } from "next/headers";
import { QueryIR } from './ir';
import { parseQuerySyntaxIntoIR, SelectMode } from './parser';
import { SearchOptions, SearchResponse, RepoResult } from "./types";
import { accumulateRepoMap, createZoektSearchRequest, zoektSearch, zoektStreamSearch } from './zoektSearcher';


type QueryStringSearchRequest = {
    queryType: 'string';
    query: string;
    options: SearchOptions;
    source?: string;
}

type QueryIRSearchRequest = {
    queryType: 'ir';
    query: QueryIR;
    options: Omit<SearchOptions, 'isRegexEnabled' | 'isCaseSensitivityEnabled'>;
    source?: string;
}

type SearchRequest = QueryStringSearchRequest | QueryIRSearchRequest;

export const search = (request: SearchRequest) => sew(() =>
    withOptionalAuthV2(async ({ prisma, user, org }) => {
        if (user) {
            const source = request.source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            getAuditService().createAudit({
                action: 'user.performed_code_search',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source },
            });
        }

        const repoSearchScope = await getAccessibleRepoNamesForUser({ user, prisma });

        let selectMode: SelectMode = null;
        const query = request.queryType === 'string' ? await (async () => {
            const { ir, selectMode: mode } = await parseQuerySyntaxIntoIR({
                query: request.query,
                options: request.options,
                prisma,
            });
            selectMode = mode;
            return ir;
        })() : request.query;

        const zoektSearchRequest = await createZoektSearchRequest({
            query,
            options: request.options,
            repoSearchScope,
        });

        const result = await zoektSearch(zoektSearchRequest, prisma);
        if (selectMode === 'repo') {
            return applySelectRepo(result);
        }
        return result;
    }));

export const streamSearch = (request: SearchRequest) => sew(() =>
    withOptionalAuthV2(async ({ prisma, user, org }) => {
        if (user) {
            const source = request.source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            getAuditService().createAudit({
                action: 'user.performed_code_search',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source },
            });
        }

        const repoSearchScope = await getAccessibleRepoNamesForUser({ user, prisma });

        let selectMode: SelectMode = null;
        const query = request.queryType === 'string' ? await (async () => {
            const { ir, selectMode: mode } = await parseQuerySyntaxIntoIR({
                query: request.query,
                options: request.options,
                prisma,
            });
            selectMode = mode;
            return ir;
        })() : request.query;

        const zoektSearchRequest = await createZoektSearchRequest({
            query,
            options: request.options,
            repoSearchScope,
        });

        return zoektStreamSearch(zoektSearchRequest, prisma, selectMode);
    }));

const getAccessibleRepoNamesForUser = async ({ user, prisma }: { user?: UserWithAccounts, prisma: PrismaClient }) => {
    if (
        env.PERMISSION_SYNC_ENABLED !== 'true' ||
        !hasEntitlement('permission-syncing')
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

const applySelectRepo = (result: SearchResponse): SearchResponse => {
    const repoMap = new Map<number, RepoResult>();
    accumulateRepoMap(result.files, result.repositoryInfo, repoMap);
    return {
        ...result,
        repoResults: Array.from(repoMap.values()).sort((a, b) => b.matchCount - a.matchCount),
        files: [],
    };
};
