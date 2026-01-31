import { sew } from '@/actions';
import { ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from '@sourcebot/shared';
import { notFound } from 'next/navigation';
import simpleGit from 'simple-git';
import z from 'zod';
import { fileTreeNodeSchema } from './types';
import { buildFileTree, isPathValid, logger, normalizePath } from './utils';

export const getTreeRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
    paths: z.array(z.string()),
});
export type GetTreeRequest = z.infer<typeof getTreeRequestSchema>;

export const getTreeResponseSchema = z.object({
    tree: fileTreeNodeSchema,
});
export type GetTreeResponse = z.infer<typeof getTreeResponseSchema>;

/**
 * Returns a file tree spanning the union of all provided paths for the given
 * repo/revision, including intermediate directories needed to connect them
 * into a single tree.
 */
export const getTree = async ({ repoName, revisionName, paths }: GetTreeRequest): Promise<GetTreeResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound();
        }

        const { path: repoPath } = getRepoPath(repo);

        const git = simpleGit().cwd(repoPath);
        if (!paths.every(path => isPathValid(path))) {
            return notFound();
        }

        const normalizedPaths = paths.map(path => normalizePath(path));

        let result: string = '';
        try {

            const command = [
                // Disable quoting of non-ASCII characters in paths
                '-c', 'core.quotePath=false',
                'ls-tree',
                revisionName,
                // format as output as {type},{path}
                '--format=%(objecttype),%(path)',
                // include tree nodes
                '-t',
                '--',
                '.',
                ...normalizedPaths,
            ];

            result = await git.raw(command);
        } catch (error) {
            logger.error('git ls-tree failed.', { error });
            return unexpectedError('git ls-tree command failed.');
        }

        const lines = result.split('\n').filter(line => line.trim());

        const flatList = lines.map(line => {
            const commaIndex = line.indexOf(',');
            const type = line.substring(0, commaIndex);
            const path = line.substring(commaIndex + 1);
            return {
                type,
                path,
            }
        });

        const tree = buildFileTree(flatList);

        return {
            tree,
        }
    }));
