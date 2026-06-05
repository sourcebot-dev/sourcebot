import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { McpToolSet } from './mcpClientFactory';
import { createLogger, env } from '@sourcebot/shared';
import Ajv from 'ajv';
import { jsonSchema, ToolExecutionOptions } from 'ai';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { createHash } from 'crypto';
import { getExternalMcpErrorLogFields } from './externalMcpError';
import { getMcpFaviconUrl } from '@/features/chat/mcp/utils';
import { __unsafePrisma } from '@/prisma';
import { McpServerToolPermission, Prisma } from '@sourcebot/db';
import { captureEvent } from '@/lib/posthog';
import type { AskMcpAnalyticsSource } from '@/lib/posthogEvents';
import { getRedisClient } from '@/lib/redis';
import {
    createMissingMcpServerToolRows,
    getMcpServerToolPermission,
    getMcpServerToolPermissionsByServerId,
} from './mcpToolPermissions';

const logger = createLogger('mcp-tool-sets');
const ajv = new Ajv({ allErrors: true, strict: false });
const MCP_LIST_TOOLS_CACHE_TTL_SECONDS = 60 * 60;
type ListToolsResult = Awaited<ReturnType<MCPClient['listTools']>>;

class McpToolTimeoutError extends Error {
    constructor(toolName: string, timeoutMs: number) {
        super(`MCP tool "${toolName}" timed out after ${timeoutMs}ms`);
        this.name = 'McpToolTimeoutError';
    }
}

async function incrementMcpToolCallCounter(serverId: string, toolName: string) {
    try {
        await __unsafePrisma.mcpServerTool.upsert({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: serverId,
                    toolName,
                },
            },
            create: {
                mcpServerId: serverId,
                toolName,
                callCount: 1,
            },
            update: {
                callCount: { increment: 1 },
            },
        });
    } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
            throw error;
        }

        await __unsafePrisma.mcpServerTool.update({
            where: {
                mcpServerId_toolName: {
                    mcpServerId: serverId,
                    toolName,
                },
            },
            data: {
                callCount: { increment: 1 },
            },
        });
    }
}

export interface McpToolsResult {
    tools: Record<string, Awaited<ReturnType<MCPClient['tools']>>[string]>;
    failedServers: string[];
    serverFaviconUrls: Record<string, string>;
    cleanup: () => Promise<void>;
}

interface McpToolsAnalyticsContext {
    chatId?: string;
    traceId?: string;
    source: AskMcpAnalyticsSource;
}

function getMcpToolFailureReason(error: unknown): string {
    if (error instanceof McpToolTimeoutError) {
        return 'timeout';
    }

    const fields = getExternalMcpErrorLogFields(error);
    if (fields.reason) {
        return fields.reason;
    }
    if (fields.oauthError) {
        return fields.oauthError;
    }
    if (fields.statusCode) {
        return `status_${fields.statusCode}`;
    }
    if (fields.errorClass) {
        return fields.errorClass;
    }

    return 'unknown';
}

function getOAuthScopeHash(oauthScopes: string[]): string {
    if (oauthScopes.length === 0) {
        return 'none';
    }

    return createHash('sha256')
        .update(Array.from(new Set(oauthScopes)).sort().join('\0'))
        .digest('hex')
        .slice(0, 16);
}

function getMcpListToolsCacheKey(client: McpToolSet): string {
    return [
        'mcp:list-tools:v1',
        client.orgId,
        // Keyed per-user: an MCP server's tools/list response MAY vary by the
        // authorization presented (e.g. a user's granted scopes), so a cached
        // list cannot be safely shared across users of the same server.
        client.userId,
        client.serverId,
        getOAuthScopeHash(client.requestedOAuthScopes),
        client.serverUpdatedAt.getTime(),
    ].join(':');
}

async function getCachedListTools(cacheKey: string): Promise<ListToolsResult | undefined> {
    try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);
        return cached ? JSON.parse(cached) as ListToolsResult : undefined;
    } catch (error) {
        logger.warn('Failed to read cached MCP tool definitions.', {
            cacheKey,
            error: getExternalMcpErrorLogFields(error),
        });
        return undefined;
    }
}

async function setCachedListTools(cacheKey: string, toolDefinitions: ListToolsResult) {
    try {
        const redis = getRedisClient();
        await redis.set(cacheKey, JSON.stringify(toolDefinitions), 'EX', MCP_LIST_TOOLS_CACHE_TTL_SECONDS);
    } catch (error) {
        logger.warn('Failed to cache MCP tool definitions.', {
            cacheKey,
            error: getExternalMcpErrorLogFields(error),
        });
    }
}

async function getListToolsResult(
    mcpClient: MCPClient,
    client: McpToolSet,
    timeoutMs: number,
): Promise<ListToolsResult> {
    const cacheKey = getMcpListToolsCacheKey(client);
    const cached = await getCachedListTools(cacheKey);
    if (cached) {
        return cached;
    }

    const toolDefinitions = await Promise.race([
        mcpClient.listTools(),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Listing tools from MCP server "${client.serverName}" timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
    ]);
    await setCachedListTools(cacheKey, toolDefinitions);
    return toolDefinitions;
}

/**
 * Creates MCPClients from authenticated transports, retrieves their tools,
 * and returns a namespaced tool record + cleanup function.
 */
export async function getMcpTools(clients: McpToolSet[], analyticsContext?: McpToolsAnalyticsContext): Promise<McpToolsResult> {
    const allTools: McpToolsResult['tools'] = {};
    const failedServers: string[] = [];
    const serverFaviconUrls: Record<string, string> = {};
    const mcpClients: MCPClient[] = [];

    const connectionTimeoutMs = env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS;

    for (const client of clients) {
        const { serverId, serverName, sanitizedName, serverUrl, transport } = client;
        try {
            const mcpClient = await Promise.race([
                createMCPClient({ transport }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Connection to MCP server "${serverName}" timed out after ${connectionTimeoutMs}ms`)), connectionTimeoutMs)
                ),
            ]);
            mcpClients.push(mcpClient);

            const toolDefinitions = await getListToolsResult(mcpClient, client, connectionTimeoutMs);
            const tools = mcpClient.toolsFromDefinitions(toolDefinitions);
            const prefix = `mcp_${sanitizedName}`;
            await createMissingMcpServerToolRows({
                serverId,
                tools: toolDefinitions.tools.map((tool) => {
                    const readOnlyHint = tool.annotations?.readOnlyHint;

                    return {
                        toolName: tool.name,
                        ...(typeof readOnlyHint === 'boolean' ? { readOnlyHint } : {}),
                    };
                }),
            });
            const permissionsByServerId = await getMcpServerToolPermissionsByServerId({
                serverIds: [serverId],
            });
            const permissionsByToolName = permissionsByServerId.get(serverId) ?? new Map();

            for (const [toolName, tool] of Object.entries(tools)) {
                const def = toolDefinitions.tools.find(t => t.name === toolName);
                const readOnlyHint = def?.annotations?.readOnlyHint;
                const permission = getMcpServerToolPermission(
                    permissionsByToolName,
                    toolName,
                    typeof readOnlyHint === 'boolean' ? readOnlyHint : undefined,
                );
                if (permission === McpServerToolPermission.DISABLED) {
                    continue;
                }
                const needsApproval = permission === McpServerToolPermission.NEEDS_APPROVAL;

                // The @ai-sdk/mcp library sets additionalProperties: false in the JSON schema
                // sent to the model, but does NOT provide a validate function — so the AI SDK
                // skips server-side validation entirely. We compile the schema with ajv to
                // enforce parameter names at runtime, which allows experimental_repairToolCall
                // to fire on InvalidToolInputError.
                const rawSchema = def?.inputSchema ?? { type: 'object', properties: {} };
                const schema = {
                    ...rawSchema,
                    type: 'object' as const,
                    properties: (rawSchema.properties ?? {}) as Record<string, JSONSchema7Definition>,
                    additionalProperties: false,
                } satisfies JSONSchema7;
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
                    const startTime = Date.now();
                    const timeoutSignal = AbortSignal.timeout(timeoutMs);
                    const combinedSignal = options.abortSignal
                        ? AbortSignal.any([options.abortSignal, timeoutSignal])
                        : timeoutSignal;
                    let success = false;
                    let failureReason: string | undefined;

                    try {
                        const result = await originalExecute(input, {
                            ...options,
                            abortSignal: combinedSignal,
                        });

                        // Await the analytics write before returning the tool result so a later
                        // denied approval cannot end the turn before earlier reads are counted.
                        await incrementMcpToolCallCounter(serverId, toolName).catch((error) => {
                            logger.warn('Failed to increment MCP tool call counter', {
                                serverId,
                                toolName: qualifiedName,
                                error: error instanceof Error ? error.message : String(error),
                            });
                        });

                        success = true;
                        return result;
                    } catch (error) {
                        if (timeoutSignal.aborted) {
                            logger.warn(`MCP tool "${qualifiedName}" timed out after ${timeoutMs}ms`);
                            const timeoutError = new McpToolTimeoutError(qualifiedName, timeoutMs);
                            failureReason = getMcpToolFailureReason(timeoutError);
                            throw timeoutError;
                        }
                        failureReason = getMcpToolFailureReason(error);
                        throw error;
                    } finally {
                        void captureEvent('ask_mcp_tool_call_completed', {
                            chatId: analyticsContext?.chatId,
                            traceId: analyticsContext?.traceId,
                            source: analyticsContext?.source ?? 'sourcebot-ask-agent',
                            serverId,
                            serverUrl,
                            toolName,
                            success,
                            durationMs: Date.now() - startTime,
                            ...(failureReason ? { failureReason } : {}),
                        });
                    }
                }) as typeof originalExecute;

                allTools[qualifiedName] = {
                    ...tool,
                    execute: executeWithTimeout,
                    // The @ai-sdk/mcp package bundles its own copy of @ai-sdk/provider-utils,
                    // so its Schema<unknown> isn't structurally identical to the workspace copy.
                    // The runtime shape is the same; cast through `any` to bridge the duplicate
                    // type identity (the two FlexibleSchema types differ only by their internal
                    // schemaSymbol brand).
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    inputSchema: validatedInputSchema as any,
                    ...(needsApproval ? { needsApproval: true } : {}),
                };
            }

            const faviconUrl = getMcpFaviconUrl(serverUrl, serverName);
            if (faviconUrl) {
                serverFaviconUrls[sanitizedName] = faviconUrl;
            }
        } catch (error) {
            logger.error('Failed to get tools from MCP server.', {
                serverId,
                sanitizedName,
                error: getExternalMcpErrorLogFields(error),
            });
            failedServers.push(serverName);
        }
    }

    const cleanup = async () => {
        await Promise.allSettled(
            mcpClients.map(async (client) => {
                try {
                    await client.close();
                } catch (error) {
                    logger.error('Error closing MCP client.', {
                        error: getExternalMcpErrorLogFields(error),
                    });
                }
            })
        );
    };

    return { tools: allTools, failedServers, serverFaviconUrls, cleanup };
}
