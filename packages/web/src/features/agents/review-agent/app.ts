import { Octokit } from "octokit";
import { WebhookEventDefinition } from "@octokit/webhooks/types";
import { generate_pr_reviews } from "@/features/agents/review-agent/nodes/generate_pr_reviews";
import { github_push_pr_reviews } from "@/features/agents/review-agent/nodes/github_push_pr_reviews";
import { github_pr_parser } from "@/features/agents/review-agent/nodes/github_pr_parser";
import { env } from "@/env.mjs";

const rules = [
    "Do NOT provide general feedback, summaries, explanations of changes, or praises for making good additions.",
    "Do NOT provide any advice that is not actionable or directly related to the changes.",
    "Focus solely on offering specific, objective insights based on the given context and refrain from making broad comments about potential impacts on the system or question intentions behind the changes.",
    "Keep comments concise and to the point. Every comment must highlight a specific issue and provide a clear and actionable solution to the developer.",
    "If there are no issues found on a line range, do NOT respond with any comments. This includes comments such as \"No issues found\" or \"LGTM\"."
]

export async function processGitHubPullRequest(octokit: Octokit, payload: WebhookEventDefinition<"pull-request-opened"> | WebhookEventDefinition<"pull-request-synchronize">) {
    console.log(`Received a pull request event for #${payload.pull_request.number}`);

    if (!env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not set, skipping review agent");
        return;
    }

    const prPayload = await github_pr_parser(octokit, payload);
    const fileDiffReviews = await generate_pr_reviews(prPayload, rules);
    await github_push_pr_reviews(octokit, prPayload, fileDiffReviews); 
}