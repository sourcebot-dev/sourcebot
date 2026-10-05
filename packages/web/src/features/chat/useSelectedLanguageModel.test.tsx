import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { LanguageModelSelector } from "./components/chatBox/languageModelSelector";
import { LanguageModelProvider } from "./languageModelContext";
import { LanguageModelInfo } from "./types";
import { useSelectedLanguageModel } from "./useSelectedLanguageModel";

vi.mock("./components/chatBox/modelProviderLogo", () => ({
    ModelProviderLogo: () => null,
}));

const STORAGE_KEY = "selectedLanguageModel";

const makeModel = (model: string, overrides: Partial<LanguageModelInfo> = {}): LanguageModelInfo => ({
    provider: "anthropic",
    model,
    inputModalities: ["text"],
    supportedDocumentTypes: [],
    ...overrides,
});

const oldModels = [makeModel("old-default"), makeModel("old-other")];
const newModels = [makeModel("new-default"), makeModel("new-other")];

// Mirrors a chat page: the toolbar selector and the chat thread each resolve
// the selection against the page's model list.
const Toolbar = ({ languageModels }: { languageModels: LanguageModelInfo[] }) => {
    const { selectedLanguageModel, setSelectedLanguageModel } = useSelectedLanguageModel(languageModels);
    return (
        <LanguageModelSelector
            languageModels={languageModels}
            selectedModel={selectedLanguageModel}
            onSelectedModelChange={setSelectedLanguageModel}
        />
    );
};

const Thread = ({ languageModels }: { languageModels: LanguageModelInfo[] }) => {
    const { selectedLanguageModel } = useSelectedLanguageModel(languageModels);
    return (
        <output data-testid="submitted-model" data-modalities={selectedLanguageModel?.inputModalities.join(",")}>
            {selectedLanguageModel?.model ?? "none"}
        </output>
    );
};

const ChatPage = ({ languageModels }: { languageModels: LanguageModelInfo[] }) => (
    <>
        <Toolbar languageModels={languageModels} />
        <Thread languageModels={languageModels} />
    </>
);

// The provider is mounted once by the (app) layout and survives client-side
// navigation, while each page renders with a freshly loaded model list.
const renderSession = (languageModels: LanguageModelInfo[]) => {
    const result = render(
        <LanguageModelProvider>
            <ChatPage languageModels={languageModels} />
        </LanguageModelProvider>
    );

    return {
        navigateWithModels: (nextModels: LanguageModelInfo[]) => result.rerender(
            <LanguageModelProvider>
                <ChatPage languageModels={nextModels} />
            </LanguageModelProvider>
        ),
    };
};

const selectModel = (currentModel: string, nextModel: string) => {
    fireEvent.click(screen.getByRole("button", { name: currentModel }));
    fireEvent.click(screen.getByRole("option", { name: nextModel }));
};

const getStoredModel = () => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as LanguageModelInfo).model : undefined;
};

beforeAll(() => {
    // cmdk relies on these browser APIs, which jsdom does not implement.
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    Element.prototype.scrollIntoView ??= () => {};
});

// Node 25 ships a global localStorage that shadows jsdom's, so install a fresh
// in-memory store for each test.
const installMockLocalStorage = () => {
    const store = new Map<string, string>();
    const storage: Storage = {
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
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
};

beforeEach(() => {
    installMockLocalStorage();
});

afterEach(() => {
    cleanup();
});

describe("useSelectedLanguageModel", () => {
    test("restores the stored model on mount", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldModels[1]));

        renderSession(oldModels);

        expect(screen.getByRole("button", { name: "old-other" })).toBeTruthy();
        expect(screen.getByTestId("submitted-model").textContent).toBe("old-other");
    });

    test("keeps a newly configured model selected after the config changes mid-session", () => {
        const session = renderSession(oldModels);
        session.navigateWithModels(newModels);

        selectModel("new-default", "new-other");

        expect(screen.getByRole("button", { name: "new-other" })).toBeTruthy();
        expect(screen.getByTestId("submitted-model").textContent).toBe("new-other");
        expect(getStoredModel()).toBe("new-other");
    });

    test("converges on the first configured model when the selected model is removed", () => {
        const session = renderSession(oldModels);
        selectModel("old-default", "old-other");
        expect(getStoredModel()).toBe("old-other");

        session.navigateWithModels(newModels);

        expect(screen.getByRole("button", { name: "new-default" })).toBeTruthy();
        expect(screen.getByTestId("submitted-model").textContent).toBe("new-default");
        // Reconciliation is derived, not written back, so consumers cannot
        // trigger each other into a storage write loop.
        expect(getStoredModel()).toBe("old-other");
    });

    test("uses the current config's capabilities for a stored model", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldModels[1]));
        const session = renderSession(oldModels);

        session.navigateWithModels([oldModels[0], makeModel("old-other", { inputModalities: ["text", "image"] })]);

        expect(screen.getByTestId("submitted-model").dataset.modalities).toBe("text,image");
    });

    test("selects nothing when no models are configured", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(oldModels[0]));

        renderSession([]);

        expect(screen.getByTestId("submitted-model").textContent).toBe("none");
    });
});
