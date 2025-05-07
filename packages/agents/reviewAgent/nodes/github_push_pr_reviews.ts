import { App } from "octokit";
import { sourcebot_pr_payload, sourcebot_file_diff_review } from "../types.js";

export const github_push_pr_reviews = async (app: App, pr_payload: sourcebot_pr_payload, file_diff_reviews: sourcebot_file_diff_review[]) => {
    console.log("Executing github_push_pr_reviews");

    const installationId = pr_payload.installation_id;
    const installation = await app.getInstallationOctokit(installationId);

    for (const file_diff_review of file_diff_reviews) {
        for (const review of file_diff_review.reviews) {
            await installation.rest.pulls.createReviewComment({
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
        }
    }

    console.log("Completed github_push_pr_reviews");
}