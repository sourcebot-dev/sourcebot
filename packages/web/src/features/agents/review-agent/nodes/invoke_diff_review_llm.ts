import OpenAI from "openai";
import { sourcebot_diff_review_schema, sourcebot_diff_review } from "@/features/agents/review-agent/types";
import { env } from "@/env.mjs";

export const invoke_diff_review_llm = async (prompt: string): Promise<sourcebot_diff_review> => {
    console.log("Executing invoke_diff_review_llm");
    
    if (!env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not set, skipping review agent");
        throw new Error("OPENAI_API_KEY is not set, skipping review agent");
    }
    
    const openai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
    });

    try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: prompt }
          ]
        });
    
        const openaiResponse = completion.choices[0].message.content;
        console.log("OpenAI response: ", openaiResponse);
        
        const diffReviewJson = JSON.parse(openaiResponse || '{}');
        const diffReview = sourcebot_diff_review_schema.safeParse(diffReviewJson);

        if (!diffReview.success) {
            throw new Error(`Invalid diff review format: ${diffReview.error}`);
        }

        console.log("Completed invoke_diff_review_llm");
        return diffReview.data;
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        throw error;
    }
}