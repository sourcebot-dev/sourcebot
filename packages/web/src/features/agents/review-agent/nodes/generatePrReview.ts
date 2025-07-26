import { sourcebot_pr_payload, sourcebot_diff_review, sourcebot_file_diff_review, sourcebot_context } from "@/features/agents/review-agent/types";
import { generateDiffReviewPrompt } from "@/features/agents/review-agent/nodes/generateDiffReviewPrompt";
import { invokeDiffReviewLlm } from "@/features/agents/review-agent/nodes/invokeDiffReviewLlm";
import { fetchFileContent } from "@/features/agents/review-agent/nodes/fetchFileContent";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('generate-pr-review');

export const generatePrReviews = async (reviewAgentLogPath: string | undefined, pr_payload: sourcebot_pr_payload, rules: string[]): Promise<sourcebot_file_diff_review[]> => {
    logger.debug("Executing generate_pr_reviews");

    const file_diff_reviews: sourcebot_file_diff_review[] = [];
    for (const file_diff of pr_payload.file_diffs) {
        const reviews: sourcebot_diff_review[] = [];

        for (const diff of file_diff.diffs) {
            try {
                const fileContentContext = await fetchFileContent(pr_payload, file_diff.to);
                const context: sourcebot_context[] = [
                    {
                        type: "pr_title",
                        description: "The title of the pull request",
                        context: pr_payload.title,
                    },
                    {
                        type: "pr_description",
                        description: "The description of the pull request",
                        context: pr_payload.description,
                    },
                    fileContentContext,
                ];

                const prompt = await generateDiffReviewPrompt(diff, context, rules);
                
                const diffReview = await invokeDiffReviewLlm(reviewAgentLogPath, prompt);
                reviews.push(...diffReview.reviews);
            } catch (error) {
                logger.error(`Error generating review for ${file_diff.to}: ${error}`);
            }
        }
        
        if (reviews.length > 0) {
            file_diff_reviews.push({
                filename: file_diff.to,
                reviews: reviews,
            });
        }
    }

    logger.debug("Completed generate_pr_reviews");
    return file_diff_reviews;
}