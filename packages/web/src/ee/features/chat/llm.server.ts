import 'server-only';

import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { generateText } from "ai";
import { getAISDKLanguageModelAndOptions } from "@/features/chat/llm.server";

export const generateChatNameFromMessage = async ({ message, languageModelConfig }: { message: string, languageModelConfig: LanguageModel }) => {
    const { model } = await getAISDKLanguageModelAndOptions(languageModelConfig);

    const prompt = `Convert this question into a short topic title (max 50 characters).

Rules:
- Do NOT include question words (what, where, how, why, when, which)
- Do NOT end with a question mark
- Capitalize the first letter of the title
- Focus on the subject/topic being discussed
- Make it sound like a file name or category

Examples:
"Where is the authentication code?" → "Authentication Code"
"How to setup the database?" → "Database Setup"
"What are the API endpoints?" → "API Endpoints"

User question: ${message}`;

    const result = await generateText({
        model,
        prompt,
    });

    return result.text;
}
