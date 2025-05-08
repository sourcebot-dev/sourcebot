import OpenAI from "openai";
import dotenv from "dotenv";
import { sourcebot_diff_review_schema, sourcebot_diff_review } from "../types.js";

dotenv.config();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const invoke_diff_review_llm = async (prompt: string, filename: string): Promise<sourcebot_diff_review> => {
    console.log("Executing invoke_diff_review_llm");

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