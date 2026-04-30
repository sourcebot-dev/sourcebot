import { sourcebot_context, sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { getAISDKLanguageModelAndOptions, getConfiguredLanguageModels } from "@/features/chat/utils.server";
import { validateLogPath } from "@/features/agents/review-agent/nodes/invokeDiffReviewLlm";
import { env } from "@sourcebot/shared";
import { generateText } from "ai";
import { createLogger } from "@sourcebot/shared";
import fs from "fs";

const logger = createLogger('generate-mr-summary');

/**
 * Makes a single LLM call over the entire MR diff to identify cross-file
 * semantic changes (renames, signature changes, removed exports, etc.) that
 * individual per-file reviewers should be aware of. Returns null when there
 * are no notable cross-file concerns or if the call fails — the per-file
 * review pipeline always continues regardless.
 */
export const generateMrSummary = async (
    pr_payload: sourcebot_pr_payload,
    reviewAgentLogPath: string | undefined,
): Promise<sourcebot_context | null> => {
    logger.debug("Executing generate_mr_summary");

    const models = await getConfiguredLanguageModels();
    if (models.length === 0) {
        logger.warn("No language models configured, skipping MR summary");
        return null;
    }

    let selectedModel = models[0];
    if (env.REVIEW_AGENT_MODEL) {
        const match = models.find((m) => m.displayName === modelName);
        if (match) {
            selectedModel = match;
        } else {
            logger.warn(`REVIEW_AGENT_MODEL="${env.REVIEW_AGENT_MODEL}" did not match any configured model displayName. Falling back to the first configured model.`);
        }
    }

    const { model, providerOptions, temperature } = await getAISDKLanguageModelAndOptions(selectedModel);

    const diffSummary = pr_payload.file_diffs.map((fileDiff) => {
        const header = fileDiff.from !== fileDiff.to
            ? `File: ${fileDiff.to} (renamed from ${fileDiff.from})`
            : `File: ${fileDiff.to}`;
        const hunks = fileDiff.diffs.map((d, i) =>
            `Hunk ${i + 1}:\n--- Old\n${d.oldSnippet}\n+++ New\n${d.newSnippet}`
        ).join('\n\n');
        return `${header}\n${hunks}`;
    }).join('\n\n---\n\n');

    const prompt = `You are reviewing a pull request titled "${pr_payload.title}".

Below are all the changed files and their diffs. Identify and summarise semantic changes that reviewers of individual files should be aware of — such as renamed functions or types, changed signatures or interfaces, removed exports, or behaviour changes with cross-file implications.

If there are no noteworthy cross-file semantic concerns, respond with an empty string.

# Changed Files

${diffSummary}`;

    if (reviewAgentLogPath) {
        validateLogPath(reviewAgentLogPath);
        fs.appendFileSync(reviewAgentLogPath, `\n\nMR Summary Prompt:\n${prompt}`);
    }

    try {
        const result = await generateText({
            model,
            system: "You are a code review assistant. Provide a concise plain-text summary of cross-file semantic changes in a pull request. Respond with an empty string if there are none.",
            prompt,
            providerOptions,
            temperature,
        });

        const summary = result.text.trim();

        if (reviewAgentLogPath) {
            validateLogPath(reviewAgentLogPath);
            fs.appendFileSync(reviewAgentLogPath, `\n\nMR Summary Response:\n${summary}`);
        }
        if (!summary) {
            logger.debug("No cross-file semantic changes detected, skipping summary context");
            return null;
        }

        logger.debug("Completed generate_mr_summary");
        return {
            type: "pr_summary",
            description: "A summary of cross-file semantic changes in this pull request",
            context: summary,
        };
    } catch (error) {
        logger.error("Error generating MR summary, proceeding without it:", error);
        return null;
    }
};
