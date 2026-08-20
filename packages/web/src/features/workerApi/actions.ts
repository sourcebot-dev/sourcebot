'use server';

import { sew } from "@/middleware/sew";
import { githubRateLimited, repositoryNotFound, unexpectedError } from "@/lib/serviceError";
import { withOptionalAuth } from "@/middleware/withAuth";
import { env } from "@sourcebot/shared";
import z from "zod";

const WORKER_API_URL = env.WORKER_API_URL;

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
            if (response.status === 429) {
                return githubRateLimited();
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
