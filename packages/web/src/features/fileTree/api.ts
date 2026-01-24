import 'server-only';

import { sew } from '@/actions';
import { notFound, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { createLogger, getRepoPath } from '@sourcebot/shared';
import { simpleGit } from 'simple-git';
import { FileTreeItem } from './types';
import { buildFileTree, isPathValid, normalizePath } from './utils';
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

