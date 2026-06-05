import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { createLogger, env } from '@sourcebot/shared';
import type { PrismaClient } from '@sourcebot/db';
import { getConnectedMcpClients, type McpToolSet } from './mcpClientFactory';
import { getExternalMcpErrorLogFields } from './externalMcpError';
import {
    createMissingMcpServerToolRows,
    getMcpServerToolPermission,
    getMcpServerToolPermissionsByServerId,
} from './mcpToolPermissions';
import { McpServerToolPermission } from '@sourcebot/db';
import type {
    GetMcpToolsResponse,
    ServerToolsEntry,
    ToolMetadataErrorReason,
    ToolSummary,
} from './types';

const logger = createLogger('mcp-tool-metadata');

const MCP_TOOL_METADATA_FETCH_CONCURRENCY = 4;
const MCP_TOOL_METADATA_TIMEOUT_MS = Math.min(env.SOURCEBOT_MCP_TOOL_CALL_TIMEOUT_MS, 10000);
const MCP_TOOL_METADATA_MAX_TOOLS = 200;
const MCP_TOOL_METADATA_MAX_NAME_LENGTH = 128;
const MCP_TOOL_METADATA_MAX_TITLE_LENGTH = 160;
const MCP_TOOL_METADATA_MAX_DESCRIPTION_LENGTH = 500;

class ToolMetadataTimeoutError extends Error {
    constructor() {
        super(`MCP tool metadata fetch timed out after ${MCP_TOOL_METADATA_TIMEOUT_MS}ms`);
        this.name = 'ToolMetadataTimeoutError';
    }
}

type ListToolsResult = Awaited<ReturnType<MCPClient['listTools']>>;
type ToolDefinition = ListToolsResult['tools'][number];

function removeControlCharacters(value: string): string {
    return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
}

function removeHtmlTags(value: string): string {
    // Strip repeatedly until stable: a single pass can reintroduce a tag
    // sequence (e.g. "<scr<x>ipt>" collapses to "<script>"), so loop until
    // no more tags are removed.
    let current = value;
    let previous: string;
    do {
        previous = current;
        current = current.replace(/<[^>]*>/g, '');
    } while (current !== previous);
    return current;
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const sanitized = normalizeWhitespace(removeControlCharacters(removeHtmlTags(value)));
    if (!sanitized) {
        return undefined;
    }

    return sanitized.length > maxLength ? sanitized.slice(0, maxLength).trimEnd() : sanitized;
}

function sanitizeAnnotations(tool: ToolDefinition): ToolSummary['annotations'] {
    const annotations = tool.annotations;
    if (!annotations) {
        return undefined;
    }

    const sanitized: ToolSummary['annotations'] = {};
    if (typeof annotations.readOnlyHint === 'boolean') {
        sanitized.readOnlyHint = annotations.readOnlyHint;
    }
    if (typeof annotations.destructiveHint === 'boolean') {
        sanitized.destructiveHint = annotations.destructiveHint;
    }
    if (typeof annotations.idempotentHint === 'boolean') {
        sanitized.idempotentHint = annotations.idempotentHint;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeTool(tool: ToolDefinition): ToolSummary {
    const toolWithOptionalTitle = tool as ToolDefinition & {
        title?: unknown;
        annotations?: ToolDefinition['annotations'] & { title?: unknown };
    };
    const name = sanitizeText(tool.name, MCP_TOOL_METADATA_MAX_NAME_LENGTH) ?? 'unnamed_tool';
    const title = sanitizeText(
        toolWithOptionalTitle.title ?? toolWithOptionalTitle.annotations?.title,
        MCP_TOOL_METADATA_MAX_TITLE_LENGTH,
    );
    const description = sanitizeText(tool.description, MCP_TOOL_METADATA_MAX_DESCRIPTION_LENGTH);
    const annotations = sanitizeAnnotations(tool);

    return {
        name,
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(annotations ? { annotations } : {}),
    };
}

async function withTimeout<T>(
    promise: Promise<T>,
    onTimeout: () => Promise<void>,
    onLateResolve?: (value: T) => Promise<void>,
): Promise<T> {
    promise.catch(() => undefined);

    return new Promise<T>((resolve, reject) => {
        let didTimeout = false;
        const timeoutId = setTimeout(() => {
            didTimeout = true;
            onTimeout().catch(() => undefined);
            reject(new ToolMetadataTimeoutError());
        }, MCP_TOOL_METADATA_TIMEOUT_MS);

        promise.then(
            (value) => {
                if (didTimeout) {
                    onLateResolve?.(value).catch(() => undefined);
                    return;
                }
                clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                if (didTimeout) {
                    return;
                }
                clearTimeout(timeoutId);
                reject(error);
            },
        );
    });
}

function getToolMetadataErrorReason(error: unknown): ToolMetadataErrorReason {
    if (error instanceof ToolMetadataTimeoutError) {
        return 'timeout';
    }

    const fields = getExternalMcpErrorLogFields(error);
    if (
        fields.oauthError === 'invalid_grant' ||
        fields.oauthError === 'invalid_client' ||
        fields.oauthError === 'unauthorized_client' ||
        fields.statusCode === 401 ||
        fields.statusCode === 403
    ) {
        return 'auth_failed';
    }

    if (
        fields.reason === 'dynamic_client_registration_unsupported' ||
        fields.reason === 'unsupported_grant_type' ||
        fields.reason === 'unsupported_response_type' ||
        fields.reason === 'unsupported_code_challenge_method' ||
        fields.statusCode === 404 ||
        fields.statusCode === 405
    ) {
        return 'unsupported';
    }

    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('does not support tools') || message.includes('does not support http transport')) {
        return 'unsupported';
    }

    if (fields.statusCode || fields.errorClass === 'TypeError') {
        return 'connection_failed';
    }

    return 'unknown';
}

async function cleanupMcpClient(mcpClient: MCPClient | undefined, { transport }: McpToolSet) {
    // Timeout handlers close the transport immediately to interrupt the in-flight request.
    // This final cleanup may close it again; transports are expected to tolerate that.
    await Promise.allSettled([
        mcpClient?.close(),
        transport.close(),
    ]);
}

async function fetchToolsForClient(client: McpToolSet): Promise<ServerToolsEntry> {
    let mcpClient: MCPClient | undefined;

    try {
        mcpClient = await withTimeout(
            createMCPClient({ transport: client.transport }),
            async () => {
                await client.transport.close();
            },
            async (lateClient) => {
                await lateClient.close();
            },
        );

        const result = await withTimeout(
            mcpClient.listTools(),
            async () => {
                await client.transport.close();
            },
        );

        const tools = result.tools.slice(0, MCP_TOOL_METADATA_MAX_TOOLS).map(sanitizeTool);
        const nextCursor = (result as ListToolsResult & { nextCursor?: unknown }).nextCursor;
        const truncated = result.tools.length > MCP_TOOL_METADATA_MAX_TOOLS || typeof nextCursor === 'string';

        return {
            status: 'available',
            serverId: client.serverId,
            tools,
            ...(truncated ? { truncated } : {}),
        };
    } catch (error) {
        const reason = getToolMetadataErrorReason(error);
        logger.warn('Failed to load MCP tool metadata.', {
            serverId: client.serverId,
            sanitizedName: client.sanitizedName,
            reason,
            error: getExternalMcpErrorLogFields(error),
        });

        return {
            status: 'error',
            serverId: client.serverId,
            reason,
        };
    } finally {
        await cleanupMcpClient(mcpClient, client);
    }
}

async function fetchToolsBatch(clients: McpToolSet[]): Promise<ServerToolsEntry[]> {
    const settled = await Promise.allSettled(clients.map((client) => fetchToolsForClient(client)));
    return settled.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }

        // Defensive: fetchToolsForClient should catch per-server failures and resolve.
        const client = clients[index];
        logger.warn('Failed to load MCP tool metadata.', {
            serverId: client.serverId,
            sanitizedName: client.sanitizedName,
            reason: 'unknown' satisfies ToolMetadataErrorReason,
            error: getExternalMcpErrorLogFields(result.reason),
        });

        return {
            status: 'error',
            serverId: client.serverId,
            reason: 'unknown',
        };
    });
}

async function createMissingToolRows(entries: ServerToolsEntry[]) {
    await Promise.all(entries.map(async (entry) => {
        if (entry.status !== 'available') {
            return;
        }

        await createMissingMcpServerToolRows({
            serverId: entry.serverId,
            tools: entry.tools.map((tool) => ({
                toolName: tool.name,
                readOnlyHint: tool.annotations?.readOnlyHint,
            })),
        });
    }));
}

async function applyVisibleToolPermissions(entries: ServerToolsEntry[]): Promise<ServerToolsEntry[]> {
    const serverIds = entries
        .filter((entry) => entry.status === 'available')
        .map((entry) => entry.serverId);
    const permissionsByServerId = await getMcpServerToolPermissionsByServerId({ serverIds });

    return entries.map((entry) => {
        if (entry.status !== 'available') {
            return entry;
        }

        const permissionsByToolName = permissionsByServerId.get(entry.serverId) ?? new Map();
        return {
            ...entry,
            tools: entry.tools.flatMap((tool) => {
                const permission = getMcpServerToolPermission(
                    permissionsByToolName,
                    tool.name,
                    tool.annotations?.readOnlyHint,
                );

                if (permission === McpServerToolPermission.DISABLED) {
                    return [];
                }

                return [{ ...tool, permission }];
            }),
        };
    });
}

async function getMcpToolMetadataEntries(
    prisma: PrismaClient,
    userId: string,
    orgId: number,
    options: {
        serverId?: string;
        includeDisabled?: boolean;
    } = {},
): Promise<GetMcpToolsResponse> {
    const allClients = await getConnectedMcpClients(prisma, userId, orgId);
    const clients = options.serverId
        ? allClients.filter((client) => client.serverId === options.serverId)
        : allClients;
    const results: ServerToolsEntry[] = [];

    for (let index = 0; index < clients.length; index += MCP_TOOL_METADATA_FETCH_CONCURRENCY) {
        const batch = clients.slice(index, index + MCP_TOOL_METADATA_FETCH_CONCURRENCY);
        results.push(...await fetchToolsBatch(batch));
    }

    await createMissingToolRows(results);

    return options.includeDisabled === true
        ? results
        : applyVisibleToolPermissions(results);
}

export async function getMcpToolMetadata(
    prisma: PrismaClient,
    userId: string,
    orgId: number,
): Promise<GetMcpToolsResponse> {
    return getMcpToolMetadataEntries(prisma, userId, orgId);
}

export async function getMcpToolMetadataForServer(
    prisma: PrismaClient,
    userId: string,
    orgId: number,
    serverId: string,
): Promise<ServerToolsEntry | undefined> {
    const entries = await getMcpToolMetadataEntries(prisma, userId, orgId, {
        serverId,
        includeDisabled: true,
    });

    return entries[0];
}
