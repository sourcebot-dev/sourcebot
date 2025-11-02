import { Octokit } from "octokit";
import { sourcebot_pr_payload, sourcebot_file_diff_review } from "@/features/agents/review-agent/types";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('github-push-pr-reviews');

export const githubPushPrReviews = async (octokit: Octokit, pr_payload: sourcebot_pr_payload, file_diff_reviews: sourcebot_file_diff_review[]) => {
    logger.info("Executing github_push_pr_reviews");

    try {
        for (const file_diff_review of file_diff_reviews) {
            for (const review of file_diff_review.reviews) {
                try {
                    await octokit.rest.pulls.createReviewComment({
                        owner: pr_payload.owner,
                        repo: pr_payload.repo,
                        pull_number: pr_payload.number,
                        body: review.review,
                        path: file_diff_review.filename,
                        commit_id: pr_payload.head_sha,
                        side: "RIGHT",
                        ...(review.line_start === review.line_end
                            ? { line: review.line_start }
                            : {
                                start_line: review.line_start,
                                line: review.line_end,
                                start_side: "RIGHT",
                            }),
                    });
                } catch (error) {
                    logger.error(`Error pushing pr reviews for ${file_diff_review.filename}: ${error}`);
                }
            }
        }
    } catch (error) {
        logger.error(`Error pushing pr reviews: ${error}`);
    }

    logger.info("Completed github_push_pr_reviews");
}