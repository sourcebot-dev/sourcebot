import { Octokit } from "octokit";
import { generatePrReviews } from "@/features/agents/review-agent/nodes/generatePrReview";
import { githubPushPrReviews } from "@/features/agents/review-agent/nodes/githubPushPrReviews";
import { githubPrParser } from "@/features/agents/review-agent/nodes/githubPrParser";
import { env } from "@/env.mjs";
import { GitHubPullRequest } from "@/features/agents/review-agent/types";
import path from "path";
import fs from "fs";
import { createLogger } from "@sourcebot/logger";

const rules = [
    "Do NOT provide general feedback, summaries, explanations of changes, or praises for making good additions.",
    "Do NOT provide any advice that is not actionable or directly related to the changes.",
    "Do NOT provide any comments or reviews on code that you believe is good, correct, or a good addition. Your job is only to identify issues and provide feedback on how to fix them.",
    "If a review for a chunk contains different reviews at different line ranges, return a separate review object for each line range.",
    "Focus solely on offering specific, objective insights based on the given context and refrain from making broad comments about potential impacts on the system or question intentions behind the changes.",
    "Keep comments concise and to the point. Every comment must highlight a specific issue and provide a clear and actionable solution to the developer.",
    "If there are no issues found on a line range, do NOT respond with any comments. This includes comments such as \"No issues found\" or \"LGTM\"."
]

const logger = createLogger('review-agent');

export async function processGitHubPullRequest(octokit: Octokit, pullRequest: GitHubPullRequest) {
    logger.info(`Received a pull request event for #${pullRequest.number}`);

    if (!env.OPENAI_API_KEY) {
        logger.error("OPENAI_API_KEY is not set, skipping review agent");
        return;
    }

    let reviewAgentLogPath: string | undefined;
    if (env.REVIEW_AGENT_LOGGING_ENABLED) {
        const reviewAgentLogDir = path.join(env.DATA_CACHE_DIR, "review-agent");
        if (!fs.existsSync(reviewAgentLogDir)) {
            fs.mkdirSync(reviewAgentLogDir, { recursive: true });
        }

        const timestamp = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+):(\d+)/, '$3_$1_$2_$4_$5_$6');
        reviewAgentLogPath = path.join(reviewAgentLogDir, `review-agent-${pullRequest.number}-${timestamp}.log`);
        logger.info(`Review agent logging to ${reviewAgentLogPath}`);
    }

    const prPayload = await githubPrParser(octokit, pullRequest);
    const fileDiffReviews = await generatePrReviews(reviewAgentLogPath, prPayload, rules);
    await githubPushPrReviews(octokit, prPayload, fileDiffReviews); 
}