import { SBChatMessage } from '@/features/chat/types';
import { getExternalMcpErrorLogFields } from './externalMcpError';

// The tool error text doubles as the marker that lets a continuation request
// (a new HTTP request carrying the persisted messages) detect that this
// response was interrupted by an authentication failure, without persisting
// any dedicated reconnect state. Keep the prefix and marker stable.
const MCP_AUTH_REQUIRED_ERROR_PREFIX = 'Authentication required: the connection to ';
const MCP_AUTH_REQUIRED_ERROR_MARKER = 'is no longer authorized';

export interface McpToolAuthFailure {
    serverId: string;
    serverName: string;
    toolCallId: string;
}

/**
 * Classifies whether an error from an external MCP tool call is a
 * reconnectable authentication failure: the user's stored credentials no
 * longer work and a new OAuth authorization is required.
 *
 * Supported failures are `invalid_grant` (a failed token refresh), `401`
 * responses, and bare `UnauthorizedError`s from the MCP SDK (which is also
 * what a failed refresh surfaces as after the transport retries). Errors that
 * still carry a non-401 status (notably `403`) are not reconnectable, nor are
 * timeouts or unavailable servers.
 *
 * Classification uses only the log-safe fields extracted by
 * `getExternalMcpErrorLogFields` — never raw messages or bodies from the
 * external boundary.
 */
export function isReconnectRequiredMcpAuthFailure(error: unknown): boolean {
    const fields = getExternalMcpErrorLogFields(error);

    // A failed token refresh reports `invalid_grant`, typically alongside the
    // token endpoint's 400 status, so it must be checked before the status.
    if (fields.oauthError === 'invalid_grant') {
        return true;
    }

    if (fields.statusCode !== undefined) {
        return fields.statusCode === 401;
    }

    // A bare UnauthorizedError does not reveal whether it came from a 401, a
    // failed refresh, or a transformed 403; V1 accepts this ambiguity (see the
    // reauthentication plan) and treats it as reconnectable.
    return fields.errorClass === 'UnauthorizedError' || fields.errorName === 'UnauthorizedError';
}

export function createMcpAuthRequiredToolErrorText(serverName: string): string {
    return `${MCP_AUTH_REQUIRED_ERROR_PREFIX}"${serverName}" ${MCP_AUTH_REQUIRED_ERROR_MARKER}. ` +
        `Tool use has ended for this response. Do not attempt further tool calls: summarize the work that already completed, ` +
        `explain that ${serverName} needs to be reconnected, and ask the user to reconnect it before continuing.`;
}

/**
 * The safe error thrown in place of the original (potentially
 * secret-carrying) external error when a tool call fails authentication. Its
 * message is what the model and the tool result's error text see.
 */
export class McpAuthRequiredError extends Error {
    constructor(serverName: string) {
        super(createMcpAuthRequiredToolErrorText(serverName));
        this.name = 'McpAuthRequiredError';
    }
}

export function isMcpAuthRequiredToolErrorText(text: string | undefined): boolean {
    return text !== undefined &&
        text.startsWith(MCP_AUTH_REQUIRED_ERROR_PREFIX) &&
        text.includes(MCP_AUTH_REQUIRED_ERROR_MARKER);
}

export function getMcpAuthRequiredServerNameFromErrorText(text: string | undefined): string | undefined {
    if (text === undefined || !isMcpAuthRequiredToolErrorText(text)) {
        return undefined;
    }

    const suffix = text.slice(MCP_AUTH_REQUIRED_ERROR_PREFIX.length);
    const markerIndex = suffix.lastIndexOf(` ${MCP_AUTH_REQUIRED_ERROR_MARKER}`);
    if (markerIndex === -1) {
        return undefined;
    }

    const quoted = suffix.slice(0, markerIndex);
    if (quoted.length < 2 || !quoted.startsWith('"') || !quoted.endsWith('"')) {
        return undefined;
    }

    return quoted.slice(1, -1);
}

/**
 * Detects whether the given trailing assistant message was interrupted by a
 * reconnect-required authentication failure, by scanning its tool error parts
 * for the marker text. Used by continuation requests to re-enter the
 * tools-disabled final step without any persisted reconnect state.
 */
export function getMcpAuthRequiredFailureFromAssistantMessage(
    message: SBChatMessage | undefined,
): { serverName: string } | undefined {
    if (!message || message.role !== 'assistant') {
        return undefined;
    }

    for (const part of message.parts) {
        if (part.type === 'dynamic-tool' && part.state === 'output-error') {
            const serverName = getMcpAuthRequiredServerNameFromErrorText(part.errorText);
            if (serverName !== undefined) {
                return { serverName };
            }
        }
    }

    return undefined;
}

/**
 * Rewrites any still-approved tool approvals on the message to denials. Once a
 * response is interrupted by an authentication failure, later approval actions
 * are invalid: the client denies pending approvals automatically, and this
 * guards the server side against an approval that raced through anyway.
 */
export function denyApprovedToolApprovalsForAuthInterruption(
    message: SBChatMessage,
    serverName: string,
): SBChatMessage {
    return {
        ...message,
        parts: message.parts.map((part) => {
            if (part.type === 'dynamic-tool' && part.state === 'approval-responded' && part.approval.approved) {
                return {
                    ...part,
                    approval: {
                        ...part.approval,
                        approved: false,
                        reason: `Denied automatically: ${serverName} needs to be reconnected before more tools can run.`,
                    },
                };
            }
            return part;
        }),
    };
}

/**
 * The ephemeral directive appended to the model messages for the final,
 * tools-disabled step of an authentication-interrupted response. It is never
 * persisted; it only shapes the final model call.
 */
export function createMcpAuthInterruptionDirective(serverName: string): string {
    return `[SYSTEM NOTIFICATION] Authentication with the "${serverName}" connector failed and tool use has been disabled for the remainder of this response. ` +
        `Do not attempt any more tool calls. Respond now with your required structured answer: briefly summarize the work you completed before the interruption, ` +
        `explain that the connection to ${serverName} is no longer authorized, and ask the user to reconnect ${serverName} before continuing.`;
}
