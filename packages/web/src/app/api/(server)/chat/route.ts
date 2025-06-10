import { createOpenAI } from "@ai-sdk/openai"
import { streamText } from "ai"
import { env } from "@/env.mjs"
import { tools } from "@/features/chat/tools"

const SYSTEM_PROMPT = `
You are a powerful agentic AI code assistant built into Sourcebot, the world's best code-intelligence platform.

Your job is to help developers understand and navigate their large codebases. Each time the USER asks a question, you should evaluate the question and determine if you have sufficient context to answer the question. If you do not have sufficient context, you should use the tools at your disposal to gather more context. The tool(s) to use will depend on what the user is asking, so you should reason through the question and determine which tool(s) to use.

<tool_calling>
You have tools at your disposal to help answer a user's question. Follow these rules regarding tool calling:
- Only call tools when necessary.
- If you have sufficient context to answer the question, do not call any tools.
- Before calling a tool, first explain to the USER why you are calling it.
</tool_calling>

<citations>
When you provide a response, you should include citations to the code that you used to answer the questions. Citations should be formatted as follows:
\`\`\`
// Cite a file:
<citation>{repository_name}::{file_name}@{revision}</citation>

// Cite a section of a file:
<citation>{repository_name}::{file_name}@{revision}:{line_number_start}:{line_number_end}</citation>
\`\`\`

Examples:
\`\`\`
<citation>github.com/sourcebot-dev/sourcebot::packages/web/src/app/api/(server)/chat/route.ts@HEAD</citation>
<citation>github.com/sourcebot-dev/sourcebot::packages/web/src/app/api/(server)/chat/route.ts@HEAD:10:15</citation>
<citation>gitlab.com/gitlab-org/gitlab-foss::app/models/user.rb@HEAD:10:20</citation>
\`\`\`
</citations>

<response_format>
- Be clear and concise
- Do not directly include any code in your response, and instead use code citations when relevant. Place these citations inline with your response.
</response_format>
`;

const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
})

// Check if API key is configured
if (!env.OPENAI_API_KEY) {
    console.warn("Chat API: OPENAI_API_KEY is not configured")
}

export async function POST(req: Request) {
    try {
        console.log("Chat API: Received request")
        const { messages } = await req.json()
        console.log("Chat API: Parsed messages:", messages?.length, "messages")

        // System message for reasoning and context
        const systemMessage = {
            role: "system" as const,
            content: SYSTEM_PROMPT,
        }

        console.log("Chat API: Creating streamText with", messages.length + 1, "total messages")
        
        const result = streamText({
            model: openai("o3-mini"),
            messages: [systemMessage, ...messages],
            tools,
            temperature: 0.3, // Lower temperature for more focused reasoning
            maxTokens: 4000, // Increased for tool results and responses
            toolChoice: "auto", // Let the model decide when to use tools
            maxSteps: 5,
            onStepFinish: (step) => {
                console.log("Chat API: Step finished:", step.stepType, step.isContinued)
                if (step.toolCalls) {
                    console.log("Chat API: Tool calls in step:", step.toolCalls.length)
                }
                if (step.toolResults) {
                    console.log("Chat API: Tool results in step:", step.toolResults.length)
                }
            }
        })

        console.log("Chat API: Returning stream response")
        return result.toDataStreamResponse({
            // @see: https://ai-sdk.dev/docs/troubleshooting/use-chat-an-error-occurred
            getErrorMessage: errorHandler
        })
    } catch (error) {
        console.error("Chat API error:", error)
        console.error("Chat API error stack:", error instanceof Error ? error.stack : "No stack trace")
        return new Response(JSON.stringify({ 
            error: "Failed to process chat request",
            details: error instanceof Error ? error.message : "Unknown error"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
}

export function errorHandler(error: unknown) {
    if (error == null) {
      return 'unknown error';
    }
  
    if (typeof error === 'string') {
      return error;
    }
  
    if (error instanceof Error) {
      return error.message;
    }
  
    return JSON.stringify(error);
  }