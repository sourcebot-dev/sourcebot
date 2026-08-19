'use server';

import { getBullMQClient } from '@/lib/bullmqClient';
import { unexpectedError } from '@/lib/serviceError';
import { sew } from '@/middleware/sew';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { OrgRole } from '@sourcebot/db';
import { JOB_PRIORITIES, REPO_INDEX_QUEUE } from '@sourcebot/shared';

const MAX_CONCURRENT_REPO_RETRIES = 10;

export type ScheduledRepoIndexJob = {
    repoId: number;
    jobId: string;
};

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
                    { repoId: repo.id },
                    { priority: JOB_PRIORITIES.INTERACTIVE },
                );

                return { jobId };
            } catch {
                return unexpectedError('Failed to index repo');
            }
        })
    )
);

export const retryReposWithSyncIssues = async () => sew(() =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const client = getBullMQClient();
                const failedJobIds = await client.getFailedJobIds(
                    REPO_INDEX_QUEUE,
                );
                const repos = await prisma.repo.findMany({
                    where: {
                        orgId: org.id,
                        latestIndexingJobId: { in: failedJobIds },
                    },
                    orderBy: { id: 'asc' },
                    select: { id: true },
                });

                const jobs: ScheduledRepoIndexJob[] = [];
                let failedCount = 0;

                for (
                    let offset = 0;
                    offset < repos.length;
                    offset += MAX_CONCURRENT_REPO_RETRIES
                ) {
                    const batch = repos.slice(
                        offset,
                        offset + MAX_CONCURRENT_REPO_RETRIES,
                    );
                    const results = await Promise.allSettled(
                        batch.map(async ({ id: repoId }) => ({
                            repoId,
                            jobId: await client.enqueue(
                                REPO_INDEX_QUEUE,
                                { repoId },
                                { priority: JOB_PRIORITIES.INTERACTIVE },
                            ),
                        })),
                    );

                    for (const result of results) {
                        if (result.status === 'fulfilled') {
                            jobs.push(result.value);
                        } else {
                            failedCount += 1;
                        }
                    }
                }

                return { jobs, failedCount };
            } catch {
                return unexpectedError('Failed to retry repository syncs');
            }
        })
    )
);
