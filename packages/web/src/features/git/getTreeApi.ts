import { sew } from '@/actions';
import { getAuditService } from '@/ee/features/audit/factory';
import { invalidGitRef, notFound, ServiceError, unexpectedError } from '@/lib/serviceError';
import { withOptionalAuthV2 } from "@/withAuthV2";
import { getRepoPath } from '@sourcebot/shared';
import { headers } from 'next/headers';
import simpleGit from 'simple-git';
import type z from 'zod';
import { getTreeRequestSchema, getTreeResponseSchema } from './schemas';
import { buildFileTree, isGitRefValid, isPathValid, logger, normalizePath } from './utils';

export { getTreeRequestSchema, getTreeResponseSchema } from './schemas';
export type GetTreeRequest = z.infer<typeof getTreeRequestSchema>;
export type GetTreeResponse = z.infer<typeof getTreeResponseSchema>;

/**
 * Returns a file tree spanning the union of all provided paths for the given
 * repo/revision, including intermediate directories needed to connect them
 * into a single tree.
 */
export const getTree = async ({ repoName, revisionName, paths }: GetTreeRequest, { source }: { source?: string } = {}): Promise<GetTreeResponse | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma, user }) => {
        if (user) {
            const resolvedSource = source ?? (await headers()).get('X-Sourcebot-Client-Source') ?? undefined;
            getAuditService().createAudit({
                action: 'user.fetched_file_tree',
                actor: { id: user.id, type: 'user' },
                target: { id: org.id.toString(), type: 'org' },
                orgId: org.id,
                metadata: { source: resolvedSource },
            });
        }

        const repo = await prisma.repo.findFirst({
            where: {
                name: repoName,
                orgId: org.id,
            },
        });

        if (!repo) {
            return notFound(`Repository "${repoName}" not found.`);
        }

        if (!isGitRefValid(revisionName)) {
            return invalidGitRef(revisionName);
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
            if (commaIndex === -1) {
                throw new Error(`Unexpected ls-tree output: ${line}`);
            }
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
