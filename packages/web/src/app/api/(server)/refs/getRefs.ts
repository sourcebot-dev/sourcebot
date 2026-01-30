import 'server-only';

import { sew } from '@/actions';
import { notFound, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { createLogger, getRepoPath, repoMetadataSchema } from '@sourcebot/shared';
import { simpleGit } from 'simple-git';

const logger = createLogger('refs');

export const getRefs = async (params: { repoName: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const { repoName } = params;
        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound();
        }

        const metadata = repoMetadataSchema.safeParse(repo.metadata);
        const indexedRevisions = metadata.success ? (metadata.data.indexedRevisions || []) : [];

        const { path: repoPath } = getRepoPath(repo);

        const git = simpleGit().cwd(repoPath);

        let allBranches: string[] = [];
        let allTags: string[] = [];
        let defaultBranch: string | null = null;

        try {
            const branchResult = await git.branch();
            allBranches = branchResult.all;
            defaultBranch = branchResult.current || null;
        } catch (error) {
            logger.error('git branch failed.', { error });
            return unexpectedError('git branch command failed.');
        }

        try {
            const tagResult = await git.tags();
            allTags = tagResult.all;
        } catch (error) {
            logger.error('git tags failed.', { error });
            return unexpectedError('git tags command failed.');
        }

        const indexedRefsSet = new Set(indexedRevisions);

        const branches = allBranches.filter(branch => {
            return indexedRefsSet.has(`refs/heads/${branch}`);
        });

        const tags = allTags.filter(tag => {
            return indexedRefsSet.has(`refs/tags/${tag}`);
        });

        return {
            branches,
            tags,
            defaultBranch,
        };
    }));