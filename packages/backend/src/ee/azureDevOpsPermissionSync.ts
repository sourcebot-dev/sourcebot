import pLimit from 'p-limit';
import { z } from 'zod';
import { PermissionSyncUpstreamError, withPermissionSyncUpstreamError } from './permissionSyncError.js';

type AzureDevOpsRepo = {
    id: number;
    external_id: string | null;
    cloneUrl: string;
};

const itemsResponseSchema = z.object({
    count: z.number().int().nonnegative(),
    value: z.array(z.object({
        path: z.string(),
        isFolder: z.boolean(),
        gitObjectType: z.string(),
    })),
}).refine(({ count, value }) => count === value.length);

// Never send an OAuth token to a URL returned by a code host. Only extract
// the organization, then construct a request to the fixed ADO Cloud origin.
const getOrganization = (cloneUrl: string): string | undefined => {
    const url = new URL(cloneUrl);
    if (url.protocol !== 'https:' || url.port || url.password) {
        return undefined;
    }
    const organization = url.hostname === 'dev.azure.com'
        ? url.pathname.split('/')[1]
        : /^([\w-]+)\.visualstudio\.com$/.exec(url.hostname)?.[1];
    return organization && /^[\w-]+$/.test(organization) ? organization : undefined;
};

export const getAzureDevOpsReadableRepoIds = async (
    repos: AzureDevOpsRepo[],
    accessToken: string,
    signal: AbortSignal,
): Promise<number[]> => {
    const limit = pLimit(5);
    const results = await Promise.allSettled(repos.map(repo => limit(async () => {
        signal.throwIfAborted();
        const organization = getOrganization(repo.cloneUrl);
        if (!organization || !repo.external_id || !z.string().uuid().safeParse(repo.external_id).success) {
            throw new Error(`Invalid Azure DevOps Cloud repository identity for repo ${repo.id}.`);
        }

        // A successful content-metadata read verifies actual code access,
        // including ADO's group, deny, and access-level checks. Repository
        // metadata or project membership alone does not prove code access.
        // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/items/list?view=azure-devops-rest-7.1
        const url = new URL(`https://dev.azure.com/${organization}/_apis/git/repositories/${repo.external_id}/items`);
        url.search = new URLSearchParams({
            'api-version': '7.1',
            scopePath: '/',
            recursionLevel: 'none',
            includeContentMetadata: 'false',
        }).toString();

        return withPermissionSyncUpstreamError('azuredevops', 'list_accessible_repositories', async () => {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    // Match the Azure DevOps SDK's bearer-token handler:
                    // return authentication errors instead of HTML sign-in redirects.
                    'X-TFS-FedAuthRedirect': 'Suppress',
                },
                redirect: 'manual',
                signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
            });
            signal.throwIfAborted();

            // Do not mistake throttling for an access revocation.
            if (response.status === 429 || response.headers.has('retry-after')) {
                await response.body?.cancel();
                throw new PermissionSyncUpstreamError('Azure DevOps rate limited permission syncing.', {
                    provider: 'azuredevops', operation: 'list_accessible_repositories',
                    kind: 'rate_limited', status: response.status,
                });
            }
            if (response.status === 403 || response.status === 404) {
                await response.body?.cancel();
                // Missing/empty repositories are not granted access. Their
                // permissions will be checked again on the next account sync.
                return undefined;
            }
            if (response.status === 401) {
                await response.body?.cancel();
                // ADO also returns 401 when a valid user is not a member of
                // this organization. Do not revoke grants in other orgs just
                // because one organization rejects the same token.
                return 'unauthorized' as const;
            }
            if (!response.ok) {
                await response.body?.cancel();
                throw Object.assign(new Error(`Azure DevOps permission check returned HTTP ${response.status}.`), {
                    status: response.status,
                });
            }
            const result = itemsResponseSchema.parse(await response.json());
            signal.throwIfAborted();
            return result.value.some(item => item.path === '/' && item.isFolder && item.gitObjectType === 'tree')
                ? repo.id
                : undefined;
        });
    })));

    // Do not publish a partial result if any request failed. Wait for all
    // requests to settle before releasing the account's workload lock.
    signal.throwIfAborted();
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
        throw failures[0].reason;
    }
    if (results.length > 0 && results.every(result => result.status === 'fulfilled' && result.value === 'unauthorized')) {
        throw new PermissionSyncUpstreamError('Azure DevOps rejected the token for every checked repository. Reconnect your account and verify organization access.', {
            provider: 'azuredevops', operation: 'list_accessible_repositories', kind: 'credential_rejected', status: 401,
        });
    }
    return results.flatMap(result => result.status === 'fulfilled' && typeof result.value === 'number' ? [result.value] : []);
};
