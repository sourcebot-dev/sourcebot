import { sourcebot_file_diff_review, sourcebot_file_diff_review_schema } from "@/features/agents/review-agent/types";
import { getAISDKLanguageModelAndOptions, getConfiguredLanguageModels } from "@/features/chat/utils.server";
import { env } from "@sourcebot/shared";
import { generateText } from "ai";
import fs from "fs";
import path from "path";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('invoke-diff-review-llm');

export const getReviewAgentLogDir = (): string => {
    return path.join(env.DATA_CACHE_DIR, 'review-agent');
};

export const validateLogPath = (logPath: string): void => {
    const resolved = path.resolve(logPath);
    const logDir = getReviewAgentLogDir();
    if (!resolved.startsWith(logDir + path.sep)) {
        throw new Error('reviewAgentLogPath escapes log directory');
    }
};

export const invokeDiffReviewLlm = async (reviewAgentLogPath: string | undefined, prompt: string): Promise<sourcebot_file_diff_review> => {
    logger.debug("Executing invoke_diff_review_llm");

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

    if (reviewAgentLogPath) {
        validateLogPath(reviewAgentLogPath);
        fs.appendFileSync(reviewAgentLogPath, `\n\nPrompt:\n${prompt}`);
    }

    try {
        const result = await generateText({
            model,
            system: "You are a code review assistant. Respond only with valid JSON matching the expected schema.",
            prompt,
            providerOptions,
            temperature,
        });

        const responseText = result.text;
        if (reviewAgentLogPath) {
            validateLogPath(reviewAgentLogPath);
            fs.appendFileSync(reviewAgentLogPath, `\n\nResponse:\n${responseText}`);
        }

        const diffReviewJson = JSON.parse(responseText || '{}');
        const diffReview = sourcebot_file_diff_review_schema.safeParse(diffReviewJson);

        if (!diffReview.success) {
            throw new Error(`Invalid diff review format: ${diffReview.error}`);
        }

        logger.debug("Completed invoke_diff_review_llm");
        return diffReview.data;
    } catch (error) {
        logger.error('Error invoking language model:', error);
        throw error;
    }
}
