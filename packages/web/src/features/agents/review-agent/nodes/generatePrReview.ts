import { sourcebot_pr_payload, sourcebot_file_diff_review, sourcebot_context } from "@/features/agents/review-agent/types";
import { generateDiffReviewPrompt } from "@/features/agents/review-agent/nodes/generateDiffReviewPrompt";
import { invokeDiffReviewLlm } from "@/features/agents/review-agent/nodes/invokeDiffReviewLlm";
import { fetchFileContent } from "@/features/agents/review-agent/nodes/fetchFileContent";
import { generateMrSummary } from "@/features/agents/review-agent/nodes/generateMrSummary";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('generate-pr-review');

const MAX_CONCURRENT_FILE_REVIEWS = 5;

/**
 * Runs tasks with a bounded concurrency limit, returning results in the same
 * order as the input array and using the same PromiseSettledResult shape as
 * Promise.allSettled.
 */
async function withConcurrencyLimit<T>(
    tasks: Array<() => Promise<T>>,
    limit: number,
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < tasks.length) {
            const index = nextIndex++;
            try {
                results[index] = { status: 'fulfilled', value: await tasks[index]() };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
}

export const generatePrReviews = async (reviewAgentLogFileName: string | undefined, pr_payload: sourcebot_pr_payload, rules: string[]): Promise<sourcebot_file_diff_review[]> => {
    logger.debug("Executing generate_pr_reviews");

    // Run MR summary upfront to detect cross-file semantic changes.
    const mrSummaryResult = await Promise.allSettled([
        generateMrSummary(pr_payload, reviewAgentLogFileName),
    ]);

    const mrSummaryContext: sourcebot_context[] = [];
    if (mrSummaryResult[0].status === 'fulfilled' && mrSummaryResult[0].value !== null) {
        mrSummaryContext.push(mrSummaryResult[0].value);
    } else if (mrSummaryResult[0].status === 'rejected') {
        logger.warn(`MR summary generation failed: ${mrSummaryResult[0].reason}`);
    }

    // Per-file review — one LLM call per file, parallelised with a concurrency cap.
    logger.debug(`Reviewing ${pr_payload.file_diffs.length} file(s)`);
    const fileResults = await withConcurrencyLimit(
        pr_payload.file_diffs.map((file_diff) => async () => {
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
                ...mrSummaryContext,
            ];

            const prompt = await generateDiffReviewPrompt(file_diff.diffs, context, rules);
            const diffReview = await invokeDiffReviewLlm(reviewAgentLogFileName, prompt);

            if (diffReview.reviews.length === 0) {
                return null;
            }

            return {
                filename: file_diff.to,
                oldFilename: file_diff.from,
                reviews: diffReview.reviews,
            } satisfies sourcebot_file_diff_review;
        }),
        MAX_CONCURRENT_FILE_REVIEWS,
    );

    const file_diff_reviews: sourcebot_file_diff_review[] = [];
    for (const result of fileResults) {
        if (result.status === 'rejected') {
            logger.error(`Error generating review: ${result.reason}`);
        } else if (result.value !== null) {
            file_diff_reviews.push(result.value);
        }
    }

    logger.debug("Completed generate_pr_reviews");
    return file_diff_reviews;
}
