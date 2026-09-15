'use server';

import { sew } from "@/middleware/sew";
import { getAnonymousId } from "@/lib/anonymousId";
import { captureEvent } from "@/lib/posthog";
import { githubRateLimited, repositoryNotFound, unexpectedError } from "@/lib/serviceError";
import { withOptionalAuth } from "@/middleware/withAuth";
import { env } from "@sourcebot/shared";
import z from "zod";

const WORKER_API_URL = env.WORKER_API_URL;

export const addGithubRepo = async (owner: string, repo: string) => sew(() =>
    withOptionalAuth(async ({ user }) => {
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
        const result = schema.parse(data);

        const isAnonymous = user === undefined;
        const anonymousCreatorId = isAnonymous ? await getAnonymousId() : undefined;

        await captureEvent('askgh_repo_index_requested', {
            owner,
            repo,
            repoName: `${owner}/${repo}`,
            isAnonymous,
            ...(anonymousCreatorId && { anonymousCreatorId }),
            repoId: result.repoId,
        });

        return result;
    })
);
