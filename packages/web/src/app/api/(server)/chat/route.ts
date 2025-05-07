import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { env } from "@/env.mjs"

const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
    try {
        const { messages } = await req.json()

        const result = streamText({
            model: openai(
                "gpt-4o",
            ),
            messages,
            temperature: 0.7,
            maxTokens: 1000,
        })

        return result.toDataStreamResponse()
    } catch (error) {
        console.error("Chat API error:", error)
        return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
}
