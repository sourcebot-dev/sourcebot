import 'server-only';

import { sew } from '@/actions';
import { env } from '@sourcebot/shared';
import { notFound, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { Repo } from '@sourcebot/db';
import { createLogger } from '@sourcebot/shared';
import path from 'path';
import { simpleGit } from 'simple-git';
import { FileTreeItem, FileTreeNode } from './types';

const logger = createLogger('file-tree');

/**
 * Returns the tree of files (blobs) and directories (trees) for a given repository,
 * at a given revision.
 */
export const getTree = async (params: { repoName: string, revisionName: string, path: string }) => sew(() =>
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

        const pathSpecs = getPathspecs(path);

        let result: string = '';
        try {
            result= await git.raw([
                // Disable quoting of non-ASCII characters in paths
                '-c', 'core.quotePath=false',
                'ls-tree',
                revisionName,
                // format as output as {type},{path}
                '--format=%(objecttype),%(path)',
                '--',
                '.',
                ...pathSpecs,
            ])
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

// @note: we don't allow directory traversal
// or null bytes in the path.
const isPathValid = (path: string) => {
    return !path.includes('..') && !path.includes('\0');
}

const normalizePath = (path: string): string => {
    // Normalize the path by...
    let normalizedPath = path;

    // ... adding a trailing slash if it doesn't have one.
    // This is important since ls-tree won't return the contents
    // of a directory if it doesn't have a trailing slash.
    if (!normalizedPath.endsWith('/')) {
        normalizedPath = `${normalizedPath}/`;
    }

    // ... removing any leading slashes. This is needed since
    // the path is relative to the repository's root, so we
    // need a relative path.
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.slice(1);
    }

    return normalizedPath;
}

const getPathspecs = (path: string): string[] => {
    const normalizedPath = normalizePath(path);
    if (normalizedPath.length === 0) {
        return [];
    }

    const parts = normalizedPath.split('/').filter(part => part.length > 0);
    const pathspecs: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const prefix = parts.slice(0, i + 1).join('/');
        pathspecs.push(`${prefix}/`);
    }

    return pathspecs;
}

const buildFileTree = (flatList: { type: string, path: string }[]): FileTreeNode => {
    const root: FileTreeNode = {
        name: 'root',
        path: '',
        type: 'tree',
        children: [],
    };

    for (const item of flatList) {
        const parts = item.path.split('/');
        let current: FileTreeNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLeaf = i === parts.length - 1;
            const nodeType = isLeaf ? item.type : 'tree';
            let next = current.children.find((child: FileTreeNode) => child.name === part && child.type === nodeType);

            if (!next) {
                next = {
                    name: part,
                    path: item.path,
                    type: nodeType,
                    children: [],
                };
                current.children.push(next);
            }
            current = next;
        }
    }

    const sortTree = (node: FileTreeNode): FileTreeNode => {
        if (node.type === 'blob') {
            return node;
        }

        const sortedChildren = node.children
            .map(sortTree)
            .sort((a: FileTreeNode, b: FileTreeNode) => {
                if (a.type !== b.type) {
                    return a.type === 'tree' ? -1 : 1;
                }
                return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });

        return {
            ...node,
            children: sortedChildren,
        };
    };

    return sortTree(root);
}

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
