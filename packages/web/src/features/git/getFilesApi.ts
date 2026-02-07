import { sew } from '@/actions';
import { FileTreeItem, fileTreeItemSchema } from "./types";
import { notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from '@sourcebot/shared';
import simpleGit from 'simple-git';
import z from 'zod';
import { logger } from './utils';

export const getFilesRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
});
export type GetFilesRequest = z.infer<typeof getFilesRequestSchema>;

export const getFilesResponseSchema = z.array(fileTreeItemSchema);
export type GetFilesResponse = z.infer<typeof getFilesResponseSchema>;

export const getFiles = async ({ repoName, revisionName }: GetFilesRequest): Promise<GetFilesResponse | ServiceError> => sew(() =>
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

        let result: string;
        try {
            result = await git.raw([
                // Disable quoting of non-ASCII characters in paths
                '-c', 'core.quotePath=false',
                'ls-tree',
                revisionName,
                // recursive
                '-r',
                // only return the names of the files
                '--name-only',
            ]);
        } catch (error) {
            logger.error('git ls-tree failed.', { error });
            return unexpectedError('git ls-tree command failed.');
        }

        const paths = result.split('\n').filter(line => line.trim());

        const files: FileTreeItem[] = paths.map(path => {
            const name = path.split('/').pop() ?? '';
            return {
                type: 'blob',
                path,
                name,
            }
        });

        return files;
    }));
