import { MCP_RECONNECT_SESSION_STORAGE_KEY } from "@/features/chat/constants";
import { normalizeMcpOAuthDraftPath } from "@/features/chat/mcpOAuthDraft";

const MCP_RECONNECT_MAX_AGE_MS = 30 * 60 * 1000;

// The reconnect metadata preserved across the current-tab OAuth redirect. It
// re-associates the reconnect flow with the failed tool call when the browser
// returns to the thread, because the in-memory reconnect state does not
// survive the navigation.
export interface McpPendingReconnect {
    serverId: string;
    serverName: string;
    toolCallId: string;
    returnTo: string;
    createdAt: number;
}

type McpPendingReconnectInput = Omit<McpPendingReconnect, 'createdAt'>;

interface ResolveMcpPendingReconnectResult {
    pending?: McpPendingReconnect;
    shouldClear: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isMcpPendingReconnect(value: unknown): value is McpPendingReconnect {
    return (
        isRecord(value) &&
        typeof value.serverId === 'string' &&
        value.serverId.length > 0 &&
        typeof value.serverName === 'string' &&
        typeof value.toolCallId === 'string' &&
        value.toolCallId.length > 0 &&
        typeof value.returnTo === 'string' &&
        typeof value.createdAt === 'number'
    );
}

export function resolveMcpPendingReconnectForPath(
    storedValue: string | null,
    currentPath: string,
    now = Date.now(),
): ResolveMcpPendingReconnectResult {
    if (!storedValue) {
        return { shouldClear: false };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(storedValue);
    } catch {
        return { shouldClear: true };
    }

    if (!isMcpPendingReconnect(parsed)) {
        return { shouldClear: true };
    }

    if (now - parsed.createdAt > MCP_RECONNECT_MAX_AGE_MS) {
        return { shouldClear: true };
    }

    const storedPath = normalizeMcpOAuthDraftPath(parsed.returnTo);
    if (!storedPath) {
        return { shouldClear: true };
    }

    const normalizedCurrentPath = normalizeMcpOAuthDraftPath(currentPath);
    if (!normalizedCurrentPath) {
        return { shouldClear: false };
    }

    if (storedPath !== normalizedCurrentPath) {
        return { shouldClear: false };
    }

    return {
        pending: {
            ...parsed,
            returnTo: storedPath,
        },
        shouldClear: true,
    };
}

function getSessionStorage(): Storage | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        return window.sessionStorage;
    } catch {
        return undefined;
    }
}

export function saveMcpPendingReconnect(input: McpPendingReconnectInput): void {
    const storage = getSessionStorage();
    const returnTo = normalizeMcpOAuthDraftPath(input.returnTo);
    if (!storage || !returnTo) {
        return;
    }

    try {
        storage.setItem(MCP_RECONNECT_SESSION_STORAGE_KEY, JSON.stringify({
            ...input,
            returnTo,
            createdAt: Date.now(),
        } satisfies McpPendingReconnect));
    } catch {
        // If sessionStorage is unavailable or full, OAuth should still proceed.
    }
}

export function clearMcpPendingReconnect(): void {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(MCP_RECONNECT_SESSION_STORAGE_KEY);
    } catch {
        // Ignore storage cleanup failures.
    }
}

export function consumeMcpPendingReconnectForPath(currentPath: string): McpPendingReconnect | undefined {
    const storage = getSessionStorage();
    if (!storage) {
        return undefined;
    }

    const result = resolveMcpPendingReconnectForPath(
        storage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY),
        currentPath,
    );

    if (result.shouldClear) {
        clearMcpPendingReconnect();
    }

    return result.pending;
}
