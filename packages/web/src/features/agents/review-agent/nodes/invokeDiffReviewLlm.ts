import OpenAI from "openai";
import { sourcebot_file_diff_review, sourcebot_file_diff_review_schema } from "@/features/agents/review-agent/types";
import { env } from "@sourcebot/shared";
import fs from "fs";
import path from "path";
import { createLogger } from "@sourcebot/shared";

const logger = createLogger('invoke-diff-review-llm');

const REVIEW_AGENT_LOG_BASE = path.join(env.DATA_CACHE_DIR, 'review-agent');

const validateReviewAgentLogPath = (logPath: string): void => {
    const resolved = path.resolve(logPath);
    if (!resolved.startsWith(REVIEW_AGENT_LOG_BASE + path.sep)) {
        throw new Error('reviewAgentLogPath escapes log directory');
    }
};

export const invokeDiffReviewLlm = async (reviewAgentLogPath: string | undefined, prompt: string): Promise<sourcebot_file_diff_review> => {
    logger.debug("Executing invoke_diff_review_llm");
    
    if (!env.OPENAI_API_KEY) {
        logger.error("OPENAI_API_KEY is not set, skipping review agent");
        throw new Error("OPENAI_API_KEY is not set, skipping review agent");
    }

    if (reviewAgentLogPath) {
        validateReviewAgentLogPath(reviewAgentLogPath);
    }
    
    const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
    });

    if (reviewAgentLogPath) {
        fs.appendFileSync(reviewAgentLogPath, `\n\nPrompt:\n${prompt}`);
    }

    try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: prompt }
          ]
        });
    
        const openaiResponse = completion.choices[0].message.content;
        if (reviewAgentLogPath) {
            fs.appendFileSync(reviewAgentLogPath, `\n\nResponse:\n${openaiResponse}`);
        }
        
        const diffReviewJson = JSON.parse(openaiResponse || '{}');
        const diffReview = sourcebot_file_diff_review_schema.safeParse(diffReviewJson);

        if (!diffReview.success) {
            throw new Error(`Invalid diff review format: ${diffReview.error}`);
        }

        logger.debug("Completed invoke_diff_review_llm");
        return diffReview.data;
    } catch (error) {
        logger.error('Error calling OpenAI:', error);
        throw error;
    }
}