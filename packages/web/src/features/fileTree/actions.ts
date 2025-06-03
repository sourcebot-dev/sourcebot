'use server';

import { sew, withAuth, withOrgMembership } from '@/actions';
import { env } from '@/env.mjs';
import { OrgRole, Repo } from '@sourcebot/db';
import { prisma } from '@/prisma';
import { notFound } from '@/lib/serviceError';
import { simpleGit } from 'simple-git';
import path from 'path';


export const getTree = async (repoName: string, revisionName: string, filePath: string, domain: string) => sew(() =>
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

            const parentDir = path.dirname(filePath);
            console.log(parentDir);

            const result = await git.raw([
                'ls-tree',
                'HEAD',
                '-r',
                '-t',
                '--format=%(objecttype),%(path)'
            ]);

            const lines = result.split('\n').filter(line => line.trim());

            const tree = lines.map(line => {
                const [type, path] = line.split(',');
                return {
                    type,
                    path,
                }
            });

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