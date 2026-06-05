import { sourcebot_pr_payload } from "@/features/agents/review-agent/types";
import { getAISDKLanguageModelAndOptions, getConfiguredLanguageModels } from "@/features/chat/utils.server";
import { env } from "@sourcebot/shared";
import { generateText } from "ai";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('generate-pr-summary');

export const generatePrSummary = async (prPayload: sourcebot_pr_payload): Promise<string> => {
    const maxSummaryLength = env.REVIEW_AGENT_SUMMARY_MAX_LENGTH;
    logger.debug("Executing generate_pr_summary");

    const models = await getConfiguredLanguageModels();
    if (models.length === 0) {
        throw new Error("No language models are configured");
    }

    let selectedModel = models[0];
    if (env.REVIEW_AGENT_MODEL) {
        const match = models.find((m) => m.displayName === env.REVIEW_AGENT_MODEL);
        if (match) {
            selectedModel = match;
        } else {
            logger.warn(`REVIEW_AGENT_MODEL="${env.REVIEW_AGENT_MODEL}" did not match any configured model displayName. Falling back to the first configured model.`);
        }
    }

    const { model, providerOptions, temperature } = await getAISDKLanguageModelAndOptions(selectedModel);

    const filesChanged = prPayload.file_diffs.map(f => f.to).join(", ");

    const prompt = `Summarize the following pull request changes in ${maxSummaryLength} characters or fewer. Be concise and focus on what changed and why. You may use inline markdown (e.g. \`code\`, **bold**) but avoid headers, bullet lists, and block-level formatting.

PR Title: ${prPayload.title}
PR Description: ${prPayload.description}
Files changed: ${filesChanged}
`;

    const result = await generateText({
        model,
        system: `You are a code review assistant. Generate a concise markdown-compatible summary of pull request changes. The summary must be ${maxSummaryLength} characters or fewer. Avoid headers, bullet lists, and block-level formatting.`,
        prompt,
        providerOptions,
        temperature,
    });

    const summary = result.text.trim().slice(0, maxSummaryLength);

    logger.debug("Completed generate_pr_summary");
    return summary;
};
