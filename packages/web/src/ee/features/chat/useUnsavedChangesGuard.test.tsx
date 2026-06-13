import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NavigationGuardProvider } from "next-navigation-guard";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

// jsdom initializes history.state to null; the library's history augmentation
// reads fields off it, so seed an object first.
beforeEach(() => {
    window.history.replaceState({}, "");
});

// This vitest config doesn't enable RTL auto-cleanup, so unmount between tests
// to drop the window `beforeunload` listeners each render registers.
afterEach(() => {
    cleanup();
});

// A minimal underlying App Router for the guard library to wrap. Without an
// outer router there is nothing to intercept, so the guard never engages.
const makeMockRouter = (): AppRouterInstance => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
});

const renderWithRouter = (ui: React.ReactNode, router: AppRouterInstance) =>
    render(
        <AppRouterContext.Provider value={router}>
            <NavigationGuardProvider>{ui}</NavigationGuardProvider>
        </AppRouterContext.Provider>,
    );

describe("useUnsavedChangesGuard — beforeunload", () => {
    test("prevents unload when enabled", () => {
        renderWithRouter(<Noop enabled={true} />, makeMockRouter());
        const event = new Event("beforeunload", { cancelable: true });
        act(() => { window.dispatchEvent(event); });
        expect(event.defaultPrevented).toBe(true);
    });

    test("does NOT prevent unload when disabled", () => {
        renderWithRouter(<Noop enabled={false} />, makeMockRouter());
        const event = new Event("beforeunload", { cancelable: true });
        act(() => { window.dispatchEvent(event); });
        expect(event.defaultPrevented).toBe(false);
    });
});

function Noop({ enabled, confirm }: { enabled: boolean; confirm?: () => boolean }) {
    useUnsavedChangesGuard({ enabled, confirm });
    return null;
}

describe("useUnsavedChangesGuard — in-app router.push", () => {
    test("controlled mode: intercepts push and toggles `active` when enabled", async () => {
        const router = makeMockRouter();

        function Probe() {
            const r = useContext(AppRouterContext);
            const guard = useUnsavedChangesGuard({ enabled: true });
            return (
                <button type="button" data-active={guard.active} onClick={() => r?.push("/elsewhere")}>
                    go
                </button>
            );
        }

        renderWithRouter(<Probe />, router);

        fireEvent.click(screen.getByRole("button", { name: "go" }));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "go" }).getAttribute("data-active")).toBe("true");
        });
        // navigation should be suspended, not forwarded to the underlying router
        expect(router.push).not.toHaveBeenCalled();
    });

    test("confirm mode: calls confirm() on push when enabled", async () => {
        const router = makeMockRouter();
        const confirm = vi.fn(() => true);

        function Probe() {
            const r = useContext(AppRouterContext);
            useUnsavedChangesGuard({ enabled: true, confirm });
            return (
                <button type="button" onClick={() => r?.push("/elsewhere")}>
                    go
                </button>
            );
        }

        renderWithRouter(<Probe />, router);

        fireEvent.click(screen.getByRole("button", { name: "go" }));

        await waitFor(() => {
            expect(confirm).toHaveBeenCalled();
        });
    });

    test("does NOT intercept push when disabled", async () => {
        const router = makeMockRouter();

        function Probe() {
            const r = useContext(AppRouterContext);
            useUnsavedChangesGuard({ enabled: false });
            return (
                <button type="button" onClick={() => r?.push("/elsewhere")}>
                    go
                </button>
            );
        }

        renderWithRouter(<Probe />, router);

        fireEvent.click(screen.getByRole("button", { name: "go" }));

        await waitFor(() => {
            expect(router.push).toHaveBeenCalledWith("/elsewhere");
        });
    });
});
