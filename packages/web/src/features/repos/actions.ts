'use server';

import { getBullMQClient } from '@/lib/bullmqClient';
import { unexpectedError } from '@/lib/serviceError';
import { sew } from '@/middleware/sew';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { OrgRole } from '@sourcebot/db';
import { JOB_PRIORITIES, REPO_INDEX_QUEUE } from '@sourcebot/shared';

export const indexRepo = async (repoId: number) => sew(() =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const repo = await prisma.repo.findFirst({
                    where: {
                        id: repoId,
                        orgId: org.id,
                    },
                    select: {
                        id: true,
                    },
                });
                if (!repo) {
                    return unexpectedError('Failed to index repo');
                }

                const jobId = await getBullMQClient().enqueue(
                    REPO_INDEX_QUEUE,
                    { repoId: repo.id, type: 'INDEX' },
                    { priority: JOB_PRIORITIES.INTERACTIVE },
                );

                return { jobId };
            } catch {
                return unexpectedError('Failed to index repo');
            }
        })
    )
);
