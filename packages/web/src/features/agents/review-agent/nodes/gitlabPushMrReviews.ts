import { sourcebot_pr_payload, sourcebot_file_diff_review } from "@/features/agents/review-agent/types";
import { Gitlab } from "@gitbeaker/rest";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('gitlab-push-mr-reviews');

export const gitlabPushMrReviews = async (
    gitlabClient: InstanceType<typeof Gitlab>,
    projectId: number,
    prPayload: sourcebot_pr_payload,
    fileDiffReviews: sourcebot_file_diff_review[],
    summary?: string,
): Promise<void> => {
    logger.info("Executing gitlab_push_mr_reviews");

    if (summary) {
        try {
            await gitlabClient.MergeRequestNotes.create(
                projectId,
                prPayload.number,
                summary,
            );
        } catch (error) {
            logger.error(`Error posting MR summary note: ${error}`);
        }
    }

    if (!prPayload.diff_refs) {
        logger.error("diff_refs is missing from pr_payload, cannot post inline GitLab MR reviews");
        return;
    }

    const { base_sha, head_sha, start_sha } = prPayload.diff_refs;

    for (const fileDiffReview of fileDiffReviews) {
        for (const review of fileDiffReview.reviews) {
            try {
                await gitlabClient.MergeRequestDiscussions.create(
                    projectId,
                    prPayload.number,
                    review.review,
                    {
                        position: {
                            positionType: "text",
                            baseSha: base_sha,
                            headSha: head_sha,
                            startSha: start_sha,
                            newPath: fileDiffReview.filename,
                            newLine: String(review.line_end),
                        },
                    },
                );
            } catch (error) {
                // Inline comment failed (e.g. line not in diff) — fall back to a general MR note
                logger.warn(
                    `Inline comment failed for ${fileDiffReview.filename}:${review.line_start}-${review.line_end}, falling back to general note: ${error}`,
                );
                try {
                    await gitlabClient.MergeRequestNotes.create(
                        projectId,
                        prPayload.number,
                        `**${fileDiffReview.filename}** (lines ${review.line_start}–${review.line_end}):\n\n${review.review}`,
                    );
                } catch (fallbackError) {
                    logger.error(
                        `Error posting fallback note for ${fileDiffReview.filename}: ${fallbackError}`,
                    );
                }
            }
        }
    }

    logger.info("Completed gitlab_push_mr_reviews");
};
