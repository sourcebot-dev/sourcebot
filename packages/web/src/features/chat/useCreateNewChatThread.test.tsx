import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Source } from "./types";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY } from "./constants";

const mocks = vi.hoisted(() => ({
    createChat: vi.fn(),
    createUIMessage: vi.fn(),
    push: vi.fn(),
    setChatState: vi.fn(),
    toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/hooks/use-toast", () => ({
    useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("./actions", () => ({
    createChat: mocks.createChat,
}));

vi.mock("@/lib/utils", () => ({
    isServiceError: () => false,
    createPathWithQueryParams: (path: string) => path,
}));

vi.mock("./utils", () => ({
    createUIMessage: mocks.createUIMessage,
    getAllMentionElements: () => [],
    slateContentToString: () => "",
}));

vi.mock("usehooks-ts", () => ({
    useSessionStorage: () => [null, mocks.setChatState],
}));

const { useCreateNewChatThread } = await import("./useCreateNewChatThread");

afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
});

test("createChatFromSource preserves disabled MCP servers from local storage", async () => {
    const disabledMcpServerIds = ["linear", "github"];
    window.localStorage.setItem(
        DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY,
        JSON.stringify(disabledMcpServerIds),
    );
    mocks.createChat.mockResolvedValue({ id: "chat-1" });
    mocks.createUIMessage.mockReturnValue({ id: "initial-message" });
    const { result } = renderHook(() => useCreateNewChatThread());
    const source: Source = {
        type: "file",
        repo: "github.com/sourcebot-dev/sourcebot",
        path: "packages/web/src/auth.ts",
        name: "auth.ts",
        revision: "main",
    };

    await act(async () => {
        await result.current.createChatFromSource(source);
    });

    expect(mocks.createUIMessage).toHaveBeenCalledWith(
        "Explain this selected code.",
        [],
        [],
        disabledMcpServerIds,
        [],
        [source],
    );
    expect(mocks.setChatState).toHaveBeenCalledWith({
        inputMessage: { id: "initial-message" },
        selectedSearchScopes: [],
        disabledMcpServerIds,
    });
});

test("createChatFromSource ignores duplicate calls while chat creation is pending", async () => {
    let resolveCreateChat: ((value: { id: string }) => void) | undefined;
    mocks.createChat.mockImplementation(() => new Promise((resolve) => {
        resolveCreateChat = resolve;
    }));
    mocks.createUIMessage.mockReturnValue({ id: "initial-message" });
    const { result } = renderHook(() => useCreateNewChatThread());
    const source: Source = {
        type: "file",
        repo: "github.com/sourcebot-dev/sourcebot",
        path: "packages/web/src/auth.ts",
        name: "auth.ts",
        revision: "main",
    };

    let firstCreate: Promise<void> | undefined;
    let secondCreate: Promise<void> | undefined;
    act(() => {
        firstCreate = result.current.createChatFromSource(source);
        secondCreate = result.current.createChatFromSource(source);
    });

    expect(mocks.createChat).toHaveBeenCalledTimes(1);

    resolveCreateChat?.({ id: "chat-1" });
    await act(async () => {
        await Promise.all([firstCreate, secondCreate]);
    });

    expect(mocks.push).toHaveBeenCalledTimes(1);
});
