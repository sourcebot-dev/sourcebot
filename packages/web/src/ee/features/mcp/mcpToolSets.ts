import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { McpToolSet } from './mcpClientFactory';
import { createLogger, env } from '@sourcebot/shared';
import { sanitizeMcpServerName } from './utils';
import Ajv from 'ajv';
import { jsonSchema, ToolExecutionOptions } from 'ai';

const logger = createLogger('mcp-tool-sets');
const ajv = new Ajv({ allErrors: true, strict: false });

class McpToolTimeoutError extends Error {
    constructor(toolName: string, timeoutMs: number) {
        super(`MCP tool "${toolName}" timed out after ${timeoutMs}ms`);
        this.name = 'McpToolTimeoutError';
    }
}

export interface McpToolsResult {
    tools: Record<string, Awaited<ReturnType<MCPClient['tools']>>[string]>;
    failedServers: string[];
    serverFaviconUrls: Record<string, string>;
    cleanup: () => Promise<void>;
}

/**
 * Creates MCPClients from authenticated transports, retrieves their tools,
 * and returns a namespaced tool record + cleanup function.
 */
export async function getMcpTools(clients: McpToolSet[]): Promise<McpToolsResult> {
    const allTools: McpToolsResult['tools'] = {};
    const failedServers: string[] = [];
    const serverFaviconUrls: Record<string, string> = {};
    const mcpClients: MCPClient[] = [];

    const connectionTimeoutMs = env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS;

    for (const { serverName, serverUrl, transport } of clients) {
        try {
            const mcpClient = await Promise.race([
                createMCPClient({ transport }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Connection to MCP server "${serverName}" timed out after ${connectionTimeoutMs}ms`)), connectionTimeoutMs)
                ),
            ]);
            mcpClients.push(mcpClient);

            const toolDefinitions = await Promise.race([
                mcpClient.listTools(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Listing tools from MCP server "${serverName}" timed out after ${connectionTimeoutMs}ms`)), connectionTimeoutMs)
                ),
            ]);
            const tools = mcpClient.toolsFromDefinitions(toolDefinitions);
            const sanitizedName = sanitizeMcpServerName(serverName);
            const prefix = `mcp_${sanitizedName}`;

            for (const [toolName, tool] of Object.entries(tools)) {
                const def = toolDefinitions.tools.find(t => t.name === toolName);
                const isReadOnly = (def?.annotations as Record<string, unknown> | undefined)?.readOnlyHint === true;

                // The @ai-sdk/mcp library sets additionalProperties: false in the JSON schema
                // sent to the model, but does NOT provide a validate function — so the AI SDK
                // skips server-side validation entirely. We compile the schema with ajv to
                // enforce parameter names at runtime, which allows experimental_repairToolCall
                // to fire on InvalidToolInputError.
                const rawSchema = def?.inputSchema ?? { type: 'object', properties: {} };
                const schema = {
                    ...rawSchema,
                    type: 'object' as const,
                    properties: rawSchema.properties ?? {},
                    additionalProperties: false,
                };
                const validate = ajv.compile(schema);
                const validProperties = Object.keys(schema.properties);
                const validatedInputSchema = jsonSchema(schema, {
                    validate: async (value: unknown) => {
                        if (validate(value)) {
                            return { success: true as const, value };
                        }
                        return {
                            success: false as const,
                            error: new Error(
                                `${ajv.errorsText(validate.errors)}. The valid parameter names for this tool are: [${validProperties.join(', ')}]`
                            ),
                        };
                    },
                });

                const originalExecute = tool.execute;
                const qualifiedName = `${prefix}__${toolName}`;
                const timeoutMs = env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS;

                const executeWithTimeout = (async (input: unknown, options: ToolExecutionOptions) => {
                    const timeoutSignal = AbortSignal.timeout(timeoutMs);
                    const combinedSignal = options.abortSignal
                        ? AbortSignal.any([options.abortSignal, timeoutSignal])
                        : timeoutSignal;

                    try {
                        return await originalExecute(input, {
                            ...options,
                            abortSignal: combinedSignal,
                        });
                    } catch (error) {
                        if (timeoutSignal.aborted) {
                            logger.warn(`MCP tool "${qualifiedName}" timed out after ${timeoutMs}ms`);
                            throw new McpToolTimeoutError(qualifiedName, timeoutMs);
                        }
                        throw error;
                    }
                }) as typeof originalExecute;

                allTools[qualifiedName] = {
                    ...tool,
                    execute: executeWithTimeout,
                    inputSchema: validatedInputSchema,
                    ...(isReadOnly ? {} : { needsApproval: true }),
                };
            }

            const origin = new URL(serverUrl).origin;
            serverFaviconUrls[sanitizedName] = `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
        } catch (error) {
            logger.error(`Failed to get tools from MCP server ${serverName}:`, error);
            failedServers.push(serverName);
        }
    }

    const cleanup = async () => {
        await Promise.allSettled(
            mcpClients.map(async (client) => {
                try {
                    await client.close();
                } catch (error) {
                    logger.error('Error closing MCP client:', error);
                }
            })
        );
    };

    return { tools: allTools, failedServers, serverFaviconUrls, cleanup };
}