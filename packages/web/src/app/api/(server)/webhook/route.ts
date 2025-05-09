'use server';

import { NextRequest } from "next/server";
import { App } from "octokit";
import { WebhookEventDefinition } from "@octokit/webhooks/types";
import { env } from "@/env.mjs";
import { processGitHubPullRequest } from "@/features/agents/review-agent/app";
import fs from "fs";

let githubApp: App | undefined;
if (env.GITHUB_APP_ID && env.GITHUB_APP_WEBHOOK_SECRET && env.GITHUB_APP_PRIVATE_KEY_PATH) {
    try {
        const privateKey = fs.readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8");
        githubApp = new App({
            appId: env.GITHUB_APP_ID,
            privateKey: privateKey,
            webhooks: {
                secret: env.GITHUB_APP_WEBHOOK_SECRET,
            },
        });
    } catch (error) {
        console.error(`Error initializing GitHub app: ${error}`);
    }
}

function isPullRequestEvent(eventHeader: string, payload: unknown): payload is WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize"> {
    return eventHeader === "pull_request" && typeof payload === "object" && payload !== null && "action" in payload && typeof payload.action === "string" && (payload.action === "opened" || payload.action === "synchronize");
}

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());

    console.log('Webhook request headers:', headers);
    console.log('Webhook request body:', JSON.stringify(body, null, 2));

    const githubEvent = headers['x-github-event'];
    if (githubEvent) {
        console.log('GitHub event received:', githubEvent);

        if (!githubApp) {
            console.warn('Received GitHub webhook event but GitHub app env vars are not set');
            return Response.json({ status: 'ok' });
        }

        if (isPullRequestEvent(githubEvent, body)) {
            console.log('Received pull request event:', body);

            if (!body.installation) {
                console.error('Received github pull request event but installation is not present');
                return Response.json({ status: 'ok' });
            }

            const installationId = body.installation.id;
            const octokit = await githubApp.getInstallationOctokit(installationId);

            await processGitHubPullRequest(octokit, body);
        }
    }

    return Response.json({ status: 'ok' });
}