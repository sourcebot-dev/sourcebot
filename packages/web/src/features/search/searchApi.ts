import { sew } from "@/actions";
import { getRepoPermissionFilterForUser } from "@/prisma";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { env, hasEntitlement } from "@sourcebot/shared";
import { QueryIR } from './ir';
import { parseQuerySyntaxIntoIR } from './parser';
import { SearchOptions } from "./types";
import { createZoektSearchRequest, zoektSearch, zoektStreamSearch } from './zoektSearcher';


type QueryStringSearchRequest = {
    queryType: 'string';
    query: string;
    options: SearchOptions;
}

type QueryIRSearchRequest = {
    queryType: 'ir';
    query: QueryIR;
    // Omit options that are specific to query syntax parsing.
    options: Omit<SearchOptions, 'isRegexEnabled' | 'isCaseSensitivityEnabled'>;
}

type SearchRequest = QueryStringSearchRequest | QueryIRSearchRequest;

export const search = (request: SearchRequest) => sew(() =>
    withOptionalAuthV2(async ({ prisma, user }) => {
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
    withOptionalAuthV2(async ({ prisma, user }) => {
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
        env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED !== 'true' ||
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
