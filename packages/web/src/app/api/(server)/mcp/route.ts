import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpServer } from '@/features/mcp/server';
import { withOptionalAuthV2 } from '@/withAuthV2';
import { isServiceError } from '@/lib/utils';
import { serviceErrorResponse, ServiceError } from '@/lib/serviceError';
import { ErrorCode } from '@/lib/errorCodes';
import { StatusCodes } from 'http-status-codes';
import { NextRequest } from 'next/server';
import { sew } from '@/actions';
import { apiHandler } from '@/lib/apiHandler';
import { env } from '@sourcebot/shared';

// On 401, tell MCP clients where to find the OAuth protected resource metadata (RFC 9728)
// so they can discover the authorization server and initiate the authorization code flow.
// Only advertised when the oauth entitlement is active.
// @see: https://modelcontextprotocol.io/specification/2025-03-26/basic/authentication
// @see: https://datatracker.ietf.org/doc/html/rfc9728
function mcpErrorResponse(error: ServiceError): Response {
    const response = serviceErrorResponse(error);
    if (error.statusCode === StatusCodes.UNAUTHORIZED) {
        const issuer = env.AUTH_URL.replace(/\/$/, '');
        response.headers.set(
            'WWW-Authenticate',
            `Bearer realm="Sourcebot", resource_metadata_uri="${issuer}/.well-known/oauth-protected-resource/api/mcp"`
        );
    }
    return response;
}

// @see: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management
interface McpSession {
    server: McpServer;
    transport: WebStandardStreamableHTTPServerTransport;
    ownerId: string | null; // null for anonymous sessions
}

const MCP_SESSION_ID_HEADER = 'MCP-Session-Id';

// Module-level session store. Persists across requests within the same Node.js process.
// Suitable for containerized/single-instance deployments.
const sessions = new Map<string, McpSession>();

export const POST = apiHandler(async (request: NextRequest) => {
    const response = await sew(() =>
        withOptionalAuthV2(async ({ user }) => {
            const ownerId = user?.id ?? null;
            const sessionId = request.headers.get(MCP_SESSION_ID_HEADER);

            // Return existing session if available
            if (sessionId && sessions.has(sessionId)) {
                const session = sessions.get(sessionId)!;
                if (session.ownerId !== ownerId) {
                    return {
                        statusCode: StatusCodes.FORBIDDEN,
                        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                        message: 'Session does not belong to the authenticated user.',
                    } satisfies ServiceError;
                }
                return session.transport.handleRequest(request);
            }

            // Create a new session
            const transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: () => crypto.randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    sessions.set(newSessionId, { server: mcpServer, transport, ownerId });
                },
                onsessionclosed: async (closedSessionId) => {
                    const session = sessions.get(closedSessionId);
                    if (session) {
                        await session.server.close();
                        await session.transport.close();
                    }
                    sessions.delete(closedSessionId);
                },
            });

            const mcpServer = createMcpServer();
            await mcpServer.connect(transport);

            return transport.handleRequest(request);
        })
    );

    if (isServiceError(response)) {
        return mcpErrorResponse(response);
    }

    return response;
});

export const DELETE = apiHandler(async (request: NextRequest) => {
    const result = await sew(() =>
        withOptionalAuthV2(async ({ user }) => {
            const ownerId = user?.id ?? null;
            const sessionId = request.headers.get(MCP_SESSION_ID_HEADER);
            if (!sessionId || !sessions.has(sessionId)) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: 'Session not found.',
                } satisfies ServiceError;
            }

            const session = sessions.get(sessionId)!;
            if (session.ownerId !== ownerId) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: 'Session does not belong to the authenticated user.',
                } satisfies ServiceError;
            }

            return session.transport.handleRequest(request);
        })
    );

    if (isServiceError(result)) {
        return mcpErrorResponse(result);
    }

    return result;
});

export const GET = apiHandler(async (request: NextRequest) => {
    const result = await sew(() =>
        withOptionalAuthV2(async ({ user }) => {
            const ownerId = user?.id ?? null;
            const sessionId = request.headers.get(MCP_SESSION_ID_HEADER);
            if (!sessionId || !sessions.has(sessionId)) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.NOT_FOUND,
                    message: 'Session not found.',
                } satisfies ServiceError;
            }

            const session = sessions.get(sessionId)!;
            if (session.ownerId !== ownerId) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: 'Session does not belong to the authenticated user.',
                } satisfies ServiceError;
            }

            return session.transport.handleRequest(request);
        })
    );

    if (isServiceError(result)) {
        return mcpErrorResponse(result);
    }

    return result;
});
