import { sourcebot_pr_payload, sourcebot_diff_review, sourcebot_file_diff_review, sourcebot_context } from "@/features/agents/review-agent/types";
import { generate_diff_review_prompt } from "@/features/agents/review-agent/nodes/generate_diff_review_prompt";
import { invoke_diff_review_llm } from "@/features/agents/review-agent/nodes/invoke_diff_review_llm";
import { fetch_file_content } from "@/features/agents/review-agent/nodes/fetch_file_content";

export const generate_pr_reviews = async (pr_payload: sourcebot_pr_payload, rules: string[]): Promise<sourcebot_file_diff_review[]> => {
    console.log("Executing generate_pr_reviews");

    const file_diff_reviews: sourcebot_file_diff_review[] = [];
    for (const file_diff of pr_payload.file_diffs) {
        const reviews: sourcebot_diff_review[] = [];

        for (const diff of file_diff.diffs) {
            try {
                const fileContentContext = await fetch_file_content(pr_payload, file_diff.to);
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

                const prompt = await generate_diff_review_prompt(diff, context, rules);
                
                const diffReview = await invoke_diff_review_llm(prompt);
                reviews.push(diffReview);
            } catch (error) {
                console.error(`Error fetching file content for ${file_diff.to}: ${error}`);
            }
        }
        
        if (reviews.length > 0) {
            file_diff_reviews.push({
                filename: file_diff.to,
                reviews: reviews,
            });
        }
    }

    console.log("Completed generate_pr_reviews");
    return file_diff_reviews;
}