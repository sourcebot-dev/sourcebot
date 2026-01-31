import { sew } from '@/actions';
import { FileTreeItem } from "./types";
import { unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from '@sourcebot/shared';
import { notFound } from 'next/navigation';
import simpleGit from 'simple-git';
import z from 'zod';
import { compareFileTreeItems, isPathValid, logger, normalizePath } from './utils';

export const getFolderContentsRequestSchema = z.object({
    repoName: z.string(),
    revisionName: z.string(),
    path: z.string(),
});
export type GetFolderContentsRequest = z.infer<typeof getFolderContentsRequestSchema>;

/**
 * Returns the contents of a folder at a given path in a given repository,
 * at a given revision.
 */
export const getFolderContents = async ({ repoName, revisionName, path }: GetFolderContentsRequest) => sew(() =>
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

        if (!isPathValid(path)) {
            return notFound();
        }
        const normalizedPath = normalizePath(path);

        let result: string;
        try {
            result = await git.raw([
                // Disable quoting of non-ASCII characters in paths
                '-c', 'core.quotePath=false',
                'ls-tree',
                revisionName,
                // format as output as {type},{path}
                '--format=%(objecttype),%(path)',
                ...(normalizedPath.length === 0 ? [] : [normalizedPath]),
            ]);
        } catch (error) {
            logger.error('git ls-tree failed.', { error });
            return unexpectedError('git ls-tree command failed.');
        }

        const lines = result.split('\n').filter(line => line.trim());

        const contents: FileTreeItem[] = lines.map(line => {
            const commaIndex = line.indexOf(',');
            const type = line.substring(0, commaIndex);
            const path = line.substring(commaIndex + 1);
            const name = path.split('/').pop() ?? '';

            return {
                type,
                path,
                name,
            }
        });

        // Sort the contents in place, first by type (trees before blobs), then by name.
        contents.sort(compareFileTreeItems);

        return contents;
    }));
