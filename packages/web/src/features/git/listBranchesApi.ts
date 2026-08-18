import { sew } from "@/middleware/sew";
import { notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuth } from '@/middleware/withAuth';
import { getRepoPath, repoMetadataSchema } from '@sourcebot/shared';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { branchSchema } from './schemas';

export type Branch = z.infer<typeof branchSchema>;

export type ListBranchesResponse = {
    repo: string;
    defaultBranch?: string;
    indexedAt?: string;
    totalCount: number;
    branches: Branch[];
};

type ListBranchesRequest = {
    repo: string;
    query?: string;
    page?: number;
    perPage?: number;
};

export const listBranches = async ({
    repo: repoName,
    query,
    page = 1,
    perPage = 50,
}: ListBranchesRequest): Promise<ListBranchesResponse | ServiceError> => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        const { path: repoPath } = getRepoPath(repo);
        const git = simpleGit().cwd(repoPath);

        try {
            // Tab is a safe separator: git ref names cannot contain whitespace
            // or control characters.
            const output = await git.raw([
                'for-each-ref',
                '--sort=-committerdate',
                '--format=%(refname:lstrip=2)%09%(objectname)%09%(committerdate:iso-strict)',
                'refs/heads',
            ]);

            const defaultBranch = repo.defaultBranch?.replace(/^refs\/heads\//, '');

            const metadataParseResult = repoMetadataSchema.safeParse(repo.metadata);
            const indexedRevisions = metadataParseResult.success
                ? (metadataParseResult.data.indexedRevisions ?? [])
                : [];

            const allBranches: Branch[] = output
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                    const [name, commit, committedAt] = line.split('\t');
                    const isDefault = name === defaultBranch;
                    const isIndexed =
                        indexedRevisions.includes(`refs/heads/${name}`) ||
                        indexedRevisions.includes(name) ||
                        (isDefault && indexedRevisions.includes('HEAD'));
                    return { name, commit, committedAt, isDefault, isIndexed };
                });

            const filteredBranches = query
                ? allBranches.filter((branch) => branch.name.toLowerCase().includes(query.toLowerCase()))
                : allBranches;

            const startIndex = (page - 1) * perPage;
            const paginatedBranches = filteredBranches.slice(startIndex, startIndex + perPage);

            return {
                repo: repo.name,
                defaultBranch,
                indexedAt: repo.indexedAt?.toISOString(),
                totalCount: filteredBranches.length,
                branches: paginatedBranches,
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('not a git repository') || errorMessage.includes('ENOENT')) {
                return unexpectedError(
                    `Local clone for repository ${repoName} is unavailable at ${repoPath}. ` +
                    `The repository may not have been fetched by Sourcebot yet.`
                );
            }

            return unexpectedError(
                `Failed to list branches in repository ${repoName}: ${errorMessage}`
            );
        }
    }));
