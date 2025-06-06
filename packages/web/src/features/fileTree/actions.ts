'use server';

import { sew, withAuth, withOrgMembership } from '@/actions';
import { env } from '@/env.mjs';
import { OrgRole, Repo } from '@sourcebot/db';
import { prisma } from '@/prisma';
import { notFound } from '@/lib/serviceError';
import { simpleGit } from 'simple-git';
import path from 'path';

export type FileTreeItem = {
    type: string;
    path: string;
    name: string;
}

export type FileTreeNode = FileTreeItem & {
    children: FileTreeNode[];
}

/**
 * Returns the tree of files (blobs) and directories (trees) for a given repository,
 * at a given revision.
 */
export const getTree = async (params: { repoName: string, revisionName: string }, domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ org }) => {
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
            const result = await git.raw([
                'ls-tree',
                revisionName,
                // recursive
                '-r',
                // include trees when recursing
                '-t',
                // format as output as {type},{path}
                '--format=%(objecttype),%(path)',
            ]);

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

        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
);

/**
 * Returns the contents of a folder at a given path in a given repository,
 * at a given revision.
 */
export const getFolderContents = async (params: { repoName: string, revisionName: string, path: string }, domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ org }) => {
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

            let normalizedPath = path;

            if (!normalizedPath.endsWith('/')) {
                normalizedPath = `${normalizedPath}/`;
            }

            if (normalizedPath.startsWith('/')) {
                normalizedPath = normalizedPath.slice(1);
            }

            const git = simpleGit().cwd(repoPath);
            const result = await git.raw([
                'ls-tree',
                revisionName,
                // format as output as {type},{path}
                '--format=%(objecttype),%(path)',
                ...(normalizedPath.length === 0 ? [] : [normalizedPath]),
            ]);

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
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowSingleTenantUnauthedAccess = */ true)
)

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
            let next = current.children.find(child => child.name === part && child.type === nodeType);

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
            .sort((a, b) => {
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
    if (repo.external_codeHostType === 'generic-git-host' && cloneUrl.protocol === 'file:') {
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
