import { askCodebase } from "@/features/mcp/askCodebase";
import { languageModelInfoSchema } from "@/features/chat/types";
import { apiHandler } from "@/lib/apiHandler";
import { requestBodySchemaValidationError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { ChatVisibility } from "@sourcebot/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request schema for the blocking chat API.
 * This is a simpler interface designed for MCP and other programmatic integrations.
 */
const blockingChatRequestSchema = z.object({
    query: z
        .string()
        .describe("The query to ask about the codebase."),
    repos: z
        .array(z.string())
        .optional()
        .describe("The repositories that are accessible to the agent during the chat. If not provided, all repositories are accessible."),
    languageModel: languageModelInfoSchema
        .optional()
        .describe("The language model to use for the chat. If not provided, the first configured model is used."),
    visibility: z
        .nativeEnum(ChatVisibility)
        .optional()
        .describe("The visibility of the chat session. If not provided, defaults to PRIVATE for authenticated users and PUBLIC for anonymous users. Set to PUBLIC to make the chat viewable by anyone with the link. Note: Anonymous users cannot create PRIVATE chats; any PRIVATE request from an unauthenticated user will be ignored and set to PUBLIC."),
});

/**
 * POST /api/chat/blocking
 *
 * A blocking (non-streaming) chat endpoint designed for MCP and other integrations.
 * Creates a chat session, runs the agent to completion, and returns the final answer.
 *
 * The chat session is persisted to the database, allowing users to view the full
 * conversation (including tool calls and reasoning) in the web UI.
 */
export const POST = apiHandler(async (request: NextRequest) => {
    const requestBody = await request.json();
    const parsed = await blockingChatRequestSchema.safeParseAsync(requestBody);

    if (!parsed.success) {
        return serviceErrorResponse(requestBodySchemaValidationError(parsed.error));
    }

    const response = await askCodebase(parsed.data);

    if (isServiceError(response)) {
        return serviceErrorResponse(response);
    }

    return NextResponse.json(response);
});
