'use server';

import { NextRequest } from "next/server";
import { App, Octokit } from "octokit";
import { WebhookEventDefinition } from "@octokit/webhooks/types";
import { EndpointDefaults } from "@octokit/types";
import { env } from "@sourcebot/shared";
import { processGitHubPullRequest } from "@/features/agents/review-agent/app";
import { throttling, type ThrottlingOptions } from "@octokit/plugin-throttling";
import fs from "fs";
import { GitHubPullRequest } from "@/features/agents/review-agent/types";
import { createLogger } from "@sourcebot/shared";
import crypto from "crypto";

const logger = createLogger('github-webhook');

const DEFAULT_GITHUB_API_BASE_URL = "https://api.github.com";
type GitHubAppBaseOptions = Omit<ConstructorParameters<typeof App>[0], "Octokit"> & { throttle: ThrottlingOptions };

let githubAppBaseOptions: GitHubAppBaseOptions | undefined;
const githubAppCache = new Map<string, App>();

if (env.GITHUB_REVIEW_AGENT_APP_ID && env.GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET && env.GITHUB_REVIEW_AGENT_APP_PRIVATE_KEY_PATH) {
    try {
        const privateKey = fs.readFileSync(env.GITHUB_REVIEW_AGENT_APP_PRIVATE_KEY_PATH, "utf8");

        githubAppBaseOptions = {
            appId: env.GITHUB_REVIEW_AGENT_APP_ID,
            privateKey,
            webhooks: {
                secret: env.GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET,
            },
            throttle: {
                enabled: true,
                onRateLimit: (retryAfter, _options, _octokit, retryCount) => {
                    if (retryCount > 3) {
                        logger.warn(`Rate limit exceeded: ${retryAfter} seconds`);
                        return false;
                    }

                    return true;
                },
                onSecondaryRateLimit: (_retryAfter, options) => {
                  // no retries on secondary rate limits
                  logger.warn(`SecondaryRateLimit detected for ${options.method} ${options.url}`);
                }
            },
        };
    } catch (error) {
        logger.error(`Error initializing GitHub app: ${error}`);
    }
}

const normalizeGithubApiBaseUrl = (baseUrl?: string) => {
    if (!baseUrl) {
        return DEFAULT_GITHUB_API_BASE_URL;
    }

    return baseUrl.replace(/\/+$/, "");
};

const resolveGithubApiBaseUrl = (headers: Record<string, string>) => {
    const enterpriseHost = headers["x-github-enterprise-host"];
    if (enterpriseHost) {
        return normalizeGithubApiBaseUrl(`https://${enterpriseHost}/api/v3`);
    }

    return DEFAULT_GITHUB_API_BASE_URL;
};

const getGithubAppForBaseUrl = (baseUrl: string) => {
    if (!githubAppBaseOptions) {
        return undefined;
    }

    const normalizedBaseUrl = normalizeGithubApiBaseUrl(baseUrl);
    const cachedApp = githubAppCache.get(normalizedBaseUrl);
    if (cachedApp) {
        return cachedApp;
    }

    const OctokitWithBaseUrl = Octokit.plugin(throttling).defaults({ baseUrl: normalizedBaseUrl });
    const app = new App({
        ...githubAppBaseOptions,
        Octokit: OctokitWithBaseUrl,
    });

    githubAppCache.set(normalizedBaseUrl, app);
    return app;
};

function isPullRequestEvent(eventHeader: string, payload: unknown): payload is WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize"> {
    return eventHeader === "pull_request" && typeof payload === "object" && payload !== null && "action" in payload && typeof payload.action === "string" && (payload.action === "opened" || payload.action === "synchronize");
}

function isIssueCommentEvent(eventHeader: string, payload: unknown): payload is WebhookEventDefinition<"issue-comment-created"> {
    return eventHeader === "issue_comment" && typeof payload === "object" && payload !== null && "action" in payload && typeof payload.action === "string" && payload.action === "created";
}

const verifyGitHubSignature = (payload: string, signature: string, secret: string): boolean => {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
};

export const POST = async (request: NextRequest) => {
    const rawBody = await request.text();
    const headers = Object.fromEntries(Array.from(request.headers.entries(), ([key, value]) => [key.toLowerCase(), value]));

    const signature = headers['x-hub-signature-256'];
    const webhookSecret = env.GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET;

    if (webhookSecret && (!signature || !verifyGitHubSignature(rawBody, signature, webhookSecret))) {
        logger.warn('Received GitHub webhook event with invalid or missing signature');
        return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(rawBody);

    const githubEvent = headers['x-github-event'];
    if (githubEvent) {
        logger.info('GitHub event received:', githubEvent);

        const githubApiBaseUrl = resolveGithubApiBaseUrl(headers);
        logger.debug('Using GitHub API base URL for event', { githubApiBaseUrl });
        const githubApp = getGithubAppForBaseUrl(githubApiBaseUrl);

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
