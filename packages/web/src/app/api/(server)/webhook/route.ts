'use server';

import { NextRequest } from "next/server";
import { App, Octokit } from "octokit";
import { WebhookEventDefinition} from "@octokit/webhooks/types";
import { EndpointDefaults } from "@octokit/types";
import { env } from "@/env.mjs";
import { processGitHubPullRequest } from "@/features/agents/review-agent/app";
import { throttling } from "@octokit/plugin-throttling";
import fs from "fs";
import { GitHubPullRequest } from "@/features/agents/review-agent/types";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('github-webhook');

let githubApp: App | undefined;
if (env.GITHUB_APP_ID && env.GITHUB_APP_WEBHOOK_SECRET && env.GITHUB_APP_PRIVATE_KEY_PATH) {
    try {
        const privateKey = fs.readFileSync(env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8");

        const throttledOctokit = Octokit.plugin(throttling);
        githubApp = new App({
            appId: env.GITHUB_APP_ID,
            privateKey: privateKey,
            webhooks: {
                secret: env.GITHUB_APP_WEBHOOK_SECRET,
            },
            Octokit: throttledOctokit,
            throttle: {
                onRateLimit: (retryAfter: number, options: Required<EndpointDefaults>, octokit: Octokit, retryCount: number) => {
                    if (retryCount > 3) {
                        logger.warn(`Rate limit exceeded: ${retryAfter} seconds`);
                        return false;
                    }

                    return true;
                },
            }
        });
    } catch (error) {
        logger.error(`Error initializing GitHub app: ${error}`);
    }
}

function isPullRequestEvent(eventHeader: string, payload: unknown): payload is WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize"> {
    return eventHeader === "pull_request" && typeof payload === "object" && payload !== null && "action" in payload && typeof payload.action === "string" && (payload.action === "opened" || payload.action === "synchronize");
}

function isIssueCommentEvent(eventHeader: string, payload: unknown): payload is WebhookEventDefinition<"issue-comment-created"> {
    return eventHeader === "issue_comment" && typeof payload === "object" && payload !== null && "action" in payload && typeof payload.action === "string" && payload.action === "created";
}

export const POST = async (request: NextRequest) => {
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());

    const githubEvent = headers['x-github-event'] || headers['X-GitHub-Event'];
    if (githubEvent) {
        logger.info('GitHub event received:', githubEvent);

        if (!githubApp) {
            logger.warn('Received GitHub webhook event but GitHub app env vars are not set');
            return Response.json({ status: 'ok' });
        }

        if (isPullRequestEvent(githubEvent, body)) {
            if (env.REVIEW_AGENT_AUTO_REVIEW_ENABLED === "false") {
                logger.info('Review agent auto review (REVIEW_AGENT_AUTO_REVIEW_ENABLED) is disabled, skipping');
                return Response.json({ status: 'ok' });
            }

            if (!body.installation) {
                logger.error('Received github pull request event but installation is not present');
                return Response.json({ status: 'ok' });
            }

            const installationId = body.installation.id;
            const octokit = await githubApp.getInstallationOctokit(installationId);

            const pullRequest = body.pull_request as GitHubPullRequest;
            await processGitHubPullRequest(octokit, pullRequest);
        }

        if (isIssueCommentEvent(githubEvent, body)) {
            const comment = body.comment.body;
            if (!comment) {
                logger.warn('Received issue comment event but comment body is empty');
                return Response.json({ status: 'ok' });
            }

            if (comment === `/${env.REVIEW_AGENT_REVIEW_COMMAND}`) {
                logger.info('Review agent review command received, processing');

                if (!body.installation) {
                    logger.error('Received github issue comment event but installation is not present');
                    return Response.json({ status: 'ok' });
                }

                const pullRequestNumber = body.issue.number;
                const repositoryName = body.repository.name;
                const owner = body.repository.owner.login;

                const octokit = await githubApp.getInstallationOctokit(body.installation.id);
                const { data: pullRequest } = await octokit.rest.pulls.get({
                    owner,
                    repo: repositoryName,
                    pull_number: pullRequestNumber,
                });

                await processGitHubPullRequest(octokit, pullRequest);
            }
        }
    }

    return Response.json({ status: 'ok' });
}