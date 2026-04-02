'use server';

import { sew } from "@/middleware/sew";
import { unexpectedError } from "@/lib/serviceError";
import { withAuth, withOptionalAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import z from "zod";

const WORKER_API_URL = 'http://localhost:3060';

export const syncConnection = async (connectionId: number) => sew(() =>
    withAuth(({ role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const response = await fetch(`${WORKER_API_URL}/api/sync-connection`, {
                method: 'POST',
                body: JSON.stringify({
                    connectionId
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                return unexpectedError('Failed to sync connection');
            }

            const data = await response.json();
            const schema = z.object({
                jobId: z.string(),
            });
            return schema.parse(data);
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