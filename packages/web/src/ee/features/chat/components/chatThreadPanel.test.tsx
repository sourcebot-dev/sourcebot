import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SET_CHAT_STATE_SESSION_STORAGE_KEY } from '@/features/chat/constants';
import { ChatThreadPanel } from './chatThreadPanel';

const { chatThreadProps } = vi.hoisted(() => ({
    chatThreadProps: [] as Array<{ disabledMcpServerIds?: unknown }>,
}));

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'chat-1' }),
}));

vi.mock('@/ee/features/chat/components/chatThread', () => ({
    ChatThread: (props: { disabledMcpServerIds?: unknown }) => {
        chatThreadProps.push(props);
        return <div data-testid="chat-thread" />;
    },
}));

function createMockStorage(): Storage {
    const store = new Map<string, string>();

    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

function installMockStorage(key: 'localStorage' | 'sessionStorage') {
    const storage = createMockStorage();
    Object.defineProperty(window, key, {
        configurable: true,
        value: storage,
    });
    Object.defineProperty(globalThis, key, {
        configurable: true,
        value: storage,
    });
}

describe('ChatThreadPanel', () => {
    beforeEach(() => {
        installMockStorage('localStorage');
        installMockStorage('sessionStorage');
        chatThreadProps.length = 0;
        sessionStorage.clear();
    });

    afterEach(() => {
        cleanup();
        sessionStorage.clear();
    });

    test('defaults restored disabled MCP server ids to an empty array when missing from session storage', async () => {
        sessionStorage.setItem(SET_CHAT_STATE_SESSION_STORAGE_KEY, JSON.stringify({
            inputMessage: {
                role: 'user',
                parts: [{ type: 'text', text: 'hello' }],
            },
            selectedSearchScopes: [],
        }));

        render(
            <ChatThreadPanel
                languageModels={[]}
                repos={[]}
                searchContexts={[]}
                messages={[]}
                isOwner={true}
                isAuthenticated={true}
            />
        );

        await waitFor(() => expect(chatThreadProps.length).toBeGreaterThan(1));

        expect(chatThreadProps.at(-1)?.disabledMcpServerIds).toEqual([]);
    });
});
