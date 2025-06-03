'use server';

import { sew, withAuth, withOrgMembership } from '@/actions';
import { env } from '@/env.mjs';
import { OrgRole, Repo } from '@sourcebot/db';
import { prisma } from '@/prisma';
import { notFound } from '@/lib/serviceError';
import { simpleGit } from 'simple-git';
import path from 'path';

export type FileTreeNode = {
    name: string;
    type: string;
    children: FileTreeNode[];
}

export const getTree = async (repoName: string, revisionName: string, domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ org }) => {

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
                '-r',
                '-t',
                '--format=%(objecttype),%(path)'
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

const buildFileTree = (flatList: { type: string, path: string }[]): FileTreeNode => {
    const root: FileTreeNode = {
        name: 'root',
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