import {
    languageModelInfoSchema,
} from '@/features/chat/types';
import { askCodebase } from '@/features/mcp/askCodebase';
import { isServiceError } from '@/lib/utils';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChatVisibility } from '@sourcebot/db';
import { SOURCEBOT_VERSION } from '@sourcebot/shared';
import _dedent from 'dedent';
import { z } from 'zod';
import { getConfiguredLanguageModelsInfo } from "../chat/utils.server";
import {
    findSymbolDefinitionsDefinition,
    findSymbolReferencesDefinition,
    listCommitsDefinition,
    listReposDefinition,
    listTreeDefinition,
    readFileDefinition,
    registerMcpTool,
    grepDefinition,
    ToolContext,
    globDefinition,
} from '../tools';

const dedent = _dedent.withOptions({ alignValues: true });

export async function createMcpServer(): Promise<McpServer> {
    const server = new McpServer({
        name: 'sourcebot-mcp-server',
        version: SOURCEBOT_VERSION,
    });

    const configuredLanguageModels = await getConfiguredLanguageModelsInfo();
    const hasLanguageModels = configuredLanguageModels.length > 0;

    const toolContext: ToolContext = {
        source: 'sourcebot-mcp-server',
    }

    registerMcpTool(server, grepDefinition, toolContext);
    registerMcpTool(server, globDefinition, toolContext);
    registerMcpTool(server, listCommitsDefinition, toolContext);
    registerMcpTool(server, listReposDefinition, toolContext);
    registerMcpTool(server, readFileDefinition, toolContext);
    registerMcpTool(server, listTreeDefinition, toolContext);
    registerMcpTool(server, findSymbolDefinitionsDefinition, toolContext);
    registerMcpTool(server, findSymbolReferencesDefinition, toolContext);

    server.registerTool(
        "list_language_models",
        {
            description: dedent`Lists the available language models configured on the Sourcebot instance. Use this to discover which models can be specified when calling ask_codebase.`,
            annotations: {
                readOnlyHint: true,
                idempotentHint: true,
            }
        },
        async () => {
            const models = await getConfiguredLanguageModelsInfo();
            return { content: [{ type: "text", text: JSON.stringify(models) }] };
        }
    );

    if (hasLanguageModels) {
        server.registerTool(
            "ask_codebase",
            {
                description: dedent`
            DO NOT USE THIS TOOL UNLESS EXPLICITLY ASKED TO. THE PROMPT MUST SPECIFICALLY ASK TO USE THE ask_codebase TOOL.

            Ask a natural language question about the codebase. This tool uses an AI agent to autonomously search code, read files, and find symbol references/definitions to answer your question.

            This is a blocking operation that may take 60+ seconds to research the codebase, so only invoke it if the user has explicitly asked you to by specifying the ask_codebase tool call in the prompt.

            The agent will:
            - Analyze your question and determine what context it needs
            - Search the codebase using multiple strategies (code search, symbol lookup, file reading)
            - Synthesize findings into a comprehensive answer with code references

            Returns a detailed answer in markdown format with code references, plus a link to view the full research session (including all tool calls and reasoning) in the Sourcebot web UI.

            When using this in shared environments (e.g., Slack), you can set the visibility parameter to 'PUBLIC' to ensure everyone can access the chat link.
            `,
                inputSchema: z.object({
                    query: z.string().describe("The query to ask about the codebase."),
                    repos: z.array(z.string()).optional().describe("The repositories accessible to the agent. If not provided, all repositories are accessible."),
                    languageModel: languageModelInfoSchema.optional().describe("The language model to use. If not provided, defaults to the first model in the config."),
                    visibility: z.enum(['PRIVATE', 'PUBLIC']).optional().describe("The visibility of the chat session. Defaults to PRIVATE for authenticated users."),
                }),
                annotations: {
                    readOnlyHint: true,
                }
            },
            async (request) => {
                const result = await askCodebase({
                    query: request.query,
                    repos: request.repos,
                    languageModel: request.languageModel,
                    visibility: request.visibility as ChatVisibility | undefined,
                    source: 'mcp',
                });

                if (isServiceError(result)) {
                    return {
                        content: [{ type: "text", text: `Failed to ask codebase: ${result.message}` }],
                    };
                }

                const formattedResponse = dedent`
                ${result.answer}

                ---
                **View full research session:** ${result.chatUrl}
                **Model used:** ${result.languageModel.model}
                `;
                return { content: [{ type: "text", text: formattedResponse }] };
            }
        );
    }

    return server;
}
