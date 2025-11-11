'use server';

import { sew } from "@/actions";
import { unexpectedError } from "@/lib/serviceError";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { OrgRole } from "@sourcebot/db";
import z from "zod";

const WORKER_API_URL = 'http://localhost:3060';

export const syncConnection = async (connectionId: number) => sew(() =>
    withAuthV2(({ role }) =>
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
    withAuthV2(({ role }) =>
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
