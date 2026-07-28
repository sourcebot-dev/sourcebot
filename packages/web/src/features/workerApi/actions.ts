'use server';

import { sew } from "@/middleware/sew";
import { notFound, repositoryNotFound, unexpectedError } from "@/lib/serviceError";
import { withAuth, withOptionalAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { CONNECTION_QUEUE, env } from "@sourcebot/shared";
import z from "zod";
import { getBullMQClient } from "@/lib/bullmqClient";

const WORKER_API_URL = env.WORKER_API_URL;

export const syncConnection = async (connectionId: number) => sew(() =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const connection = await prisma.connection.findUnique({
                where: {
                    id: connectionId,
                    orgId: org.id,
                },
                select: {
                    id: true,
                    orgId: true,
                },
            });

            if (!connection) {
                return notFound('Connection not found');
            }

            const jobId = await getBullMQClient().enqueue(CONNECTION_QUEUE, {
                connectionId: connection.id,
                orgId: connection.orgId,
            });

            return { jobId };
        })
    )
);

export const getConnectionSyncJobLogs = async (
    connectionId: number,
    jobId: string,
    start = 0,
) => sew(() =>
    withAuth(({ org, prisma, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const connection = await prisma.connection.findUnique({
                where: {
                    id: connectionId,
                    orgId: org.id,
                },
                select: {
                    id: true,
                },
            });

            if (!connection) {
                return notFound('Connection not found');
            }

            const client = getBullMQClient();
            const job = await client.getJob(CONNECTION_QUEUE, jobId);
            if (
                !job ||
                job.data.connectionId !== connection.id ||
                job.data.orgId !== org.id
            ) {
                return notFound('Connection sync job not found');
            }

            return client.getJobLogs(CONNECTION_QUEUE, jobId, {
                start: Number.isInteger(start) && start >= 0 ? start : 0,
                ascending: true,
            });
        })
    )
);

export const indexRepo = async (repoId: number) => sew(() =>
    withAuth(({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const response = await fetch(`${WORKER_API_URL}/api/index-repo`, {
                method: 'POST',
                body: JSON.stringify({ repoId }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                return unexpectedError('Failed to index repo');
            }

            const data = await response.json();
            const schema = z.object({
                jobId: z.string(),
            });
            return schema.parse(data);
        })
    )
);

export const triggerAccountPermissionSync = async (accountId: string) => sew(() =>
    withAuth(({ role }) =>
        withMinimumOrgRole(role, OrgRole.MEMBER, async () => {
            const response = await fetch(`${WORKER_API_URL}/api/trigger-account-permission-sync`, {
                method: 'POST',
                body: JSON.stringify({ accountId }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                return unexpectedError('Failed to trigger account permission sync');
            }

            const data = await response.json();
            const schema = z.object({
                jobId: z.string(),
            });
            return schema.parse(data);
        })
    )
);

export const addGithubRepo = async (owner: string, repo: string) => sew(() =>
    withOptionalAuth(async () => {
        const response = await fetch(`${WORKER_API_URL}/api/experimental/add-github-repo`, {
            method: 'POST',
            body: JSON.stringify({ owner, repo }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return repositoryNotFound(`${owner}/${repo}`);
            }
            return unexpectedError('Failed to add GitHub repo');
        }

        const data = await response.json();
        const schema = z.object({
            jobId: z.string(),
            repoId: z.number(),
        });
        return schema.parse(data);
    })
);
