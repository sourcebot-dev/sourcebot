import type { Descendant } from "slate";
import { MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY } from "@/features/chat/constants";
import { isFileMentionData, type CustomText, type MentionElement, type ParagraphElement, type SearchScope } from "@/features/chat/types";
import { isCommandMentionData } from "@/features/chat/commands/types";

const MCP_OAUTH_DRAFT_BASE_URL = 'https://sourcebot.invalid';
const MCP_OAUTH_DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
const MCP_OAUTH_STATUS_PARAMS = ['status', 'server', 'message'];

export interface McpOAuthDraft {
    returnTo: string;
    children: Descendant[];
    selectedSearchScopes: SearchScope[];
    disabledMcpServerIds: string[];
    createdAt: number;
}

type McpOAuthDraftInput = Omit<McpOAuthDraft, 'createdAt'>;

interface ResolveMcpOAuthDraftResult {
    draft?: McpOAuthDraft;
    shouldClear: boolean;
}

function isAllowedMcpOAuthDraftPath(pathname: string): boolean {
    return pathname === '/chat' || pathname.startsWith('/chat/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isCustomText(value: unknown): value is CustomText {
    return isRecord(value) && typeof value.text === 'string';
}

function isMentionElement(value: unknown): value is MentionElement {
    return (
        isRecord(value) &&
        value.type === 'mention' &&
        (isFileMentionData(value.data) || isCommandMentionData(value.data)) &&
        Array.isArray(value.children) &&
        value.children.every(isCustomText)
    );
}

function isParagraphElement(value: unknown): value is ParagraphElement {
    return (
        isRecord(value) &&
        value.type === 'paragraph' &&
        (value.align === undefined || typeof value.align === 'string') &&
        Array.isArray(value.children) &&
        value.children.length > 0 &&
        value.children.every((child) => isCustomText(child) || isMentionElement(child))
    );
}

function isMcpOAuthDraftChildren(value: unknown): value is Descendant[] {
    return Array.isArray(value) && value.length > 0 && value.every(isParagraphElement);
}

export function normalizeMcpOAuthDraftPath(path: string): string | undefined {
    const trimmedPath = path.trim();
    if (!trimmedPath || !trimmedPath.startsWith('/') || trimmedPath.startsWith('//') || trimmedPath.includes('\\')) {
        return undefined;
    }

    try {
        const url = new URL(trimmedPath, MCP_OAUTH_DRAFT_BASE_URL);
        if (url.origin !== MCP_OAUTH_DRAFT_BASE_URL || !isAllowedMcpOAuthDraftPath(url.pathname)) {
            return undefined;
        }

        for (const param of MCP_OAUTH_STATUS_PARAMS) {
            url.searchParams.delete(param);
        }

        const query = url.searchParams.toString();
        return `${url.pathname}${query ? `?${query}` : ''}`;
    } catch {
        return undefined;
    }
}

export function createMcpOAuthDraftPath(pathname: string, search: string): string | undefined {
    return normalizeMcpOAuthDraftPath(`${pathname}${search}`);
}

function isMcpOAuthDraft(value: unknown): value is McpOAuthDraft {
    return (
        isRecord(value) &&
        'returnTo' in value &&
        typeof value.returnTo === 'string' &&
        'children' in value &&
        isMcpOAuthDraftChildren(value.children) &&
        'selectedSearchScopes' in value &&
        Array.isArray(value.selectedSearchScopes) &&
        'disabledMcpServerIds' in value &&
        Array.isArray(value.disabledMcpServerIds) &&
        value.disabledMcpServerIds.every((id) => typeof id === 'string') &&
        'createdAt' in value &&
        typeof value.createdAt === 'number'
    );
}

export function resolveMcpOAuthDraftForPath(
    storedDraft: string | null,
    currentPath: string,
    now = Date.now(),
): ResolveMcpOAuthDraftResult {
    if (!storedDraft) {
        return { shouldClear: false };
    }

    let parsedDraft: unknown;
    try {
        parsedDraft = JSON.parse(storedDraft);
    } catch {
        return { shouldClear: true };
    }

    if (!isMcpOAuthDraft(parsedDraft)) {
        return { shouldClear: true };
    }

    if (now - parsedDraft.createdAt > MCP_OAUTH_DRAFT_MAX_AGE_MS) {
        return { shouldClear: true };
    }

    const storedPath = normalizeMcpOAuthDraftPath(parsedDraft.returnTo);
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
        draft: {
            ...parsedDraft,
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

export function saveMcpOAuthDraft(draft: McpOAuthDraftInput): void {
    const storage = getSessionStorage();
    const returnTo = normalizeMcpOAuthDraftPath(draft.returnTo);
    if (!storage || !returnTo) {
        return;
    }

    try {
        storage.setItem(MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY, JSON.stringify({
            ...draft,
            returnTo,
            createdAt: Date.now(),
        } satisfies McpOAuthDraft));
    } catch {
        // If sessionStorage is unavailable or full, OAuth should still proceed.
    }
}

export function clearMcpOAuthDraft(): void {
    const storage = getSessionStorage();
    if (!storage) {
        return;
    }

    try {
        storage.removeItem(MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY);
    } catch {
        // Ignore storage cleanup failures.
    }
}

export function consumeMcpOAuthDraftForPath(currentPath: string): McpOAuthDraft | undefined {
    const storage = getSessionStorage();
    if (!storage) {
        return undefined;
    }

    const result = resolveMcpOAuthDraftForPath(
        storage.getItem(MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY),
        currentPath,
    );

    if (result.shouldClear) {
        clearMcpOAuthDraft();
    }

    return result.draft;
}
