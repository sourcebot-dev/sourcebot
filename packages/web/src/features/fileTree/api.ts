import 'server-only';

import { sew } from '@/actions';
import { env } from '@sourcebot/shared';
import { notFound, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { Repo } from '@sourcebot/db';
import { createLogger } from '@sourcebot/shared';
import path from 'path';
import { simpleGit } from 'simple-git';
import { FileTreeItem } from './types';
import { buildFileTree, normalizePath } from './utils';
import { compareFileTreeItems } from './utils';

const logger = createLogger('file-tree');

/**
 * Returns a file tree spanning the union of all provided paths for the given
 * repo/revision, including intermediate directories needed to connect them
 * into a single tree.
 */
export const getTree = async (params: { repoName: string, revisionName: string, paths: string[] }) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const { repoName, revisionName, paths } = params;
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
            const [type, path] = line.split(',');
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

/**
 * Returns the contents of a folder at a given path in a given repository,
 * at a given revision.
 */
export const getFolderContents = async (params: { repoName: string, revisionName: string, path: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const { repoName, revisionName, path } = params;
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
            const [type, path] = line.split(',');
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

export const getFiles = async (params: { repoName: string, revisionName: string }) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const { repoName, revisionName } = params;

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

// @todo: this is duplicated from the `getRepoPath` function in the
// backend's `utils.ts` file. Eventually we should move this to a shared
// package.
const getRepoPath = (repo: Repo): { path: string, isReadOnly: boolean } => {
    // If we are dealing with a local repository, then use that as the path.
    // Mark as read-only since we aren't guaranteed to have write access to the local filesystem.
    const cloneUrl = new URL(repo.cloneUrl);
    if (repo.external_codeHostType === 'genericGitHost' && cloneUrl.protocol === 'file:') {
        return {
            path: cloneUrl.pathname,
            isReadOnly: true,
        }
    }

    const reposPath = path.join(env.DATA_CACHE_DIR, 'repos');

    return {
        path: path.join(reposPath, repo.id.toString()),
        isReadOnly: false,
    }
}
