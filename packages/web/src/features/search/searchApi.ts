import { sew } from "@/actions";
import { getRepoPermissionFilterForUser } from "@/prisma";
import { withOptionalAuthV2 } from "@/withAuthV2";
import { PrismaClient, Prisma, UserWithAccounts } from "@sourcebot/db";
import { env, hasEntitlement } from "@sourcebot/shared";
import { QueryIR } from './ir';
import { parseQuerySyntaxIntoIR } from './parser';
import { SearchOptions } from "./types";
import { createZoektSearchRequest, zoektSearch, zoektStreamSearch } from './zoektSearcher';
import { toDbDate } from './dateUtils';

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
    withOptionalAuthV2(async ({ prisma, user, org }) => {
        // Get repos filtered by permissions (if enabled)
        const permissionFilteredRepos = await getAccessibleRepoNamesForUser({ user, prisma });

        // Get repos filtered by temporal constraints (if specified)
        const temporalFilteredRepos = await getTemporallyFilteredRepos({
            prisma,
            org,
            since: request.options.since,
            until: request.options.until
        });

        // Combine filters: intersection of permission and temporal filters
        const repoSearchScope = combineRepoFilters(permissionFilteredRepos, temporalFilteredRepos);

        // If needed, parse the query syntax into the query intermediate representation.
        let query = request.queryType === 'string' ? await parseQuerySyntaxIntoIR({
            query: request.query,
            options: request.options,
            prisma,
        }) : request.query;

        // Apply branch filtering if gitRevision is specified
        if (request.options.gitRevision) {
            query = applyBranchFilter(query, request.options.gitRevision);
        }

        const zoektSearchRequest = await createZoektSearchRequest({
            query,
            options: request.options,
            repoSearchScope,
        });

        return zoektSearch(zoektSearchRequest, prisma);
    }));

export const streamSearch = (request: SearchRequest) => sew(() =>
    withOptionalAuthV2(async ({ prisma, user, org }) => {
        // Get repos filtered by permissions (if enabled)
        const permissionFilteredRepos = await getAccessibleRepoNamesForUser({ user, prisma });

        // Get repos filtered by temporal constraints (if specified)
        const temporalFilteredRepos = await getTemporallyFilteredRepos({
            prisma,
            org,
            since: request.options.since,
            until: request.options.until
        });

        // Combine filters: intersection of permission and temporal filters
        const repoSearchScope = combineRepoFilters(permissionFilteredRepos, temporalFilteredRepos);

        // If needed, parse the query syntax into the query intermediate representation.
        let query = request.queryType === 'string' ? await parseQuerySyntaxIntoIR({
            query: request.query,
            options: request.options,
            prisma,
        }) : request.query;

        // Apply branch filtering if gitRevision is specified
        if (request.options.gitRevision) {
            query = applyBranchFilter(query, request.options.gitRevision);
        }

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

/**
 * Returns a list of repository names filtered by temporal constraints (indexedAt).
 * If no temporal constraints are specified, returns undefined.
 * Note: This filters by when the repo was last indexed by Sourcebot, not by commit time.
 */
const getTemporallyFilteredRepos = async ({
    prisma,
    org,
    since,
    until
}: {
    prisma: PrismaClient,
    org?: { id: number },
    since?: string,
    until?: string
}) => {
    // If no temporal filters are specified, return undefined (no filtering)
    if (!since && !until) {
        return undefined;
    }

    // Validate date range if both dates are provided
    if (since && until) {
        const { validateDateRange } = await import('./dateUtils');
        const dateRangeError = validateDateRange(since, until);
        if (dateRangeError) {
            throw new Error(dateRangeError);
        }
    }

    const sinceDate = since ? toDbDate(since) : undefined;
    const untilDate = until ? toDbDate(until) : undefined;

    const where: Prisma.RepoWhereInput = {};

    // Add org filter if org is available
    if (org) {
        where.orgId = org.id;
    }

    // Add temporal filters
    where.indexedAt = {};
    if (sinceDate) {
        where.indexedAt.gte = sinceDate;
    }
    if (untilDate) {
        where.indexedAt.lte = untilDate;
    }

    const repos = await prisma.repo.findMany({
        where,
        select: { name: true }
    });

    return repos.map(repo => repo.name);
}

/**
 * Combines permission-based and temporal repo filters.
 * Returns the intersection if both filters are present, otherwise returns whichever is defined.
 */
const combineRepoFilters = (
    permissionFiltered: string[] | undefined,
    temporalFiltered: string[] | undefined
): string[] | undefined => {
    // If neither filter is defined, no filtering
    if (!permissionFiltered && !temporalFiltered) {
        return undefined;
    }

    // If only one filter is defined, use it
    if (!permissionFiltered) {
        return temporalFiltered;
    }
    if (!temporalFiltered) {
        return permissionFiltered;
    }

    // Both filters are defined: return intersection
    const temporalSet = new Set(temporalFiltered);
    return permissionFiltered.filter(repo => temporalSet.has(repo));
}

/**
 * Applies branch filtering to a QueryIR by wrapping it with a branch constraint.
 */
const applyBranchFilter = (query: QueryIR, gitRevision: string): QueryIR => {
    // Wrap the existing query with a branch filter using the 'and' operator
    return {
        and: {
            children: [
                query,
                {
                    branch: {
                        pattern: gitRevision,
                        exact: true
                    }
                }
            ]
        }
    };
}
