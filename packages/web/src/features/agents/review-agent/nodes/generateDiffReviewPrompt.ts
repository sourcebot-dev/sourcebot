import { sourcebot_diff, sourcebot_context, sourcebot_diff_review_schema } from "@/features/agents/review-agent/types";
import { zodToJsonSchema } from "zod-to-json-schema";

export const generateDiffReviewPrompt = async (diff: sourcebot_diff, context: sourcebot_context[], rules: string[]) => {
    console.log("Executing generate_diff_review_prompt");
        
    const prompt = `
    You are an expert software engineer that excells at reviewing code changes. Given the input, additional context, and rules defined below, review the code changes and provide a detailed review. The review you provide
    must conform to all of the rules defined below. The output format of your review must conform to the output format defined below.

    # Input

    The input is the old and new code snippets, which represent a single hunk from a git diff. The old code snippet is the code before the changes were made, and the new code snippet is the code after the changes were made. Each code snippet
    is a sequence of lines each with a line number.

    ## Old Code Snippet

    \`\`\`
    ${diff.oldSnippet}
    \`\`\`

    ## New Code Snippet

    \`\`\`
    ${diff.newSnippet}
    \`\`\`

    # Additional Context

    ${context.map(c => `${c.type}: ${c.description}\n\n${c.context}`).join("\n\n----------------------\n\n")}

    # Rules

    - ${rules.join("\n- ")}

    # Output Format (JSON Schema)
    The output must be a valid JSON object that conforms to the following JSON schema. Do NOT respond with anything other than the JSON object. Do NOT respond with
    the JSON object in a markdown code block.
    ${JSON.stringify(zodToJsonSchema(sourcebot_diff_review_schema), null, 2)}
    `;

    console.log("Completed generate_diff_review_prompt");
    return prompt;
}