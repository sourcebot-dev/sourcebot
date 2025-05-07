import dotenv from 'dotenv';
import { App, Octokit } from "octokit";
import { createNodeMiddleware } from "@octokit/webhooks";
import fs from "fs";
import http from "http";
import { WebhookEventDefinition } from "@octokit/webhooks/types";
import { generate_pr_reviews } from './nodes/generate_pr_reviews.js';
import { github_push_pr_reviews } from './nodes/github_push_pr_reviews.js';
import { github_pr_parser } from './nodes/github_pr_parser.js';

dotenv.config();
const appId = process.env.APP_ID as string;
const webhookSecret = process.env.WEBHOOK_SECRET as string;
const privateKeyPath = process.env.PRIVATE_KEY_PATH as string;

const privateKey = fs.readFileSync(privateKeyPath, "utf8");

const app = new App({
    appId: appId,
    privateKey: privateKey,
    webhooks: {
        secret: webhookSecret
    },
});

const rules = [
    "Do NOT provide general feedback, summaries, explanations of changes, or praises for making good additions.",
    "Do NOT provide any advice that is not actionable or directly related to the changes.",
    "Focus solely on offering specific, objective insights based on the given context and refrain from making broad comments about potential impacts on the system or question intentions behind the changes.",
    "Keep comments concise and to the point. Every comment must highlight a specific issue and provide a clear and actionable solution to the developer.",
    "If there are no issues found on a line range, do NOT respond with any comments. This includes comments such as \"No issues found\" or \"LGTM\"."
]

async function handlePullRequestOpened({
    octokit,
    payload,
}: {
    octokit: Octokit;
    payload: WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize">;
}) {
    console.log(`Received a pull request event for #${payload.pull_request.number}`);

    const prPayload = await github_pr_parser(octokit, payload);
    const fileDiffReviews = await generate_pr_reviews(prPayload, rules);
    await github_push_pr_reviews(app, prPayload, fileDiffReviews);
}

app.webhooks.on("pull_request.opened", handlePullRequestOpened);
app.webhooks.on("pull_request.synchronize", handlePullRequestOpened);

app.webhooks.onError((error) => {
    console.error(error);
});


const port = 3050;
const host = 'localhost';
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

const middleware = createNodeMiddleware(app.webhooks, { path });

http.createServer(middleware).listen(port, () => {
    console.log(`Server is listening for events at: ${localWebhookUrl}`);
    console.log('Press Ctrl + C to quit.')
});
