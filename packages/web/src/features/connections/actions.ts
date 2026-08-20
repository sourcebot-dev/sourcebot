'use server';

import { getBullMQClient } from '@/lib/bullmqClient';
import { unexpectedError } from '@/lib/serviceError';
import { sew } from '@/middleware/sew';
import { withAuth } from '@/middleware/withAuth';
import { withMinimumOrgRole } from '@/middleware/withMinimumOrgRole';
import { OrgRole } from '@sourcebot/db';
import { CONNECTION_QUEUE, JOB_PRIORITIES } from '@sourcebot/shared';

export const syncConnection = async (connectionId: number) => sew(() =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const connection = await prisma.connection.findFirst({
                    where: {
                        id: connectionId,
                        orgId: org.id,
                    },
                    select: {
                        id: true,
                    },
                });
                if (!connection) {
                    return unexpectedError('Failed to sync connection');
                }

                const jobId = await getBullMQClient().enqueue(
                    CONNECTION_QUEUE,
                    { connectionId: connection.id },
                    { priority: JOB_PRIORITIES.INTERACTIVE },
                );

                return { jobId };
            } catch {
                return unexpectedError('Failed to sync connection');
            }
        })
    )
);
