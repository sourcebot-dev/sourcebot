import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
const api = vi.hoisted(() => ({ getConnectionSyncCounts: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => navigation,
}));

vi.mock("@/app/api/(client)/client", () => ({
    getConnectionSyncCounts: api.getConnectionSyncCounts,
}));

vi.mock("@/lib/utils", () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
        classes.filter(Boolean).join(" "),
    unwrapServiceError: (value: unknown) => value,
}));

vi.mock("./bannerShell", () => ({
    BannerShell: ({ title, description, action }: {
        title: ReactNode;
        description?: ReactNode;
        action?: ReactNode;
    }) => (
        <div>
            <div>{title}</div>
            <div>{description}</div>
            <div>{action}</div>
        </div>
    ),
}));

const { ConnectionFirstSyncBanner } = await import(
    "./connectionFirstSyncBanner"
);

const renderBanner = (firstTimeSyncingCount: number) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    render(
        <QueryClientProvider client={queryClient}>
            <ConnectionFirstSyncBanner
                id="connectionFirstSync"
                dismissible={true}
                role="OWNER"
                now={new Date("2026-08-18T12:00:00Z")}
                initialCounts={{
                    firstTimeSyncingCount,
                    failedCount: 0,
                    warningCount: 0,
                }}
            />
        </QueryClientProvider>,
    );
    return queryClient;
};

beforeEach(() => {
    api.getConnectionSyncCounts.mockResolvedValue({
        firstTimeSyncingCount: 3,
        failedCount: 0,
        warningCount: 0,
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("ConnectionFirstSyncBanner", () => {
    test("updates the displayed count from the latest status", async () => {
        api.getConnectionSyncCounts.mockResolvedValueOnce({
            firstTimeSyncingCount: 2,
            failedCount: 0,
            warningCount: 0,
        });
        renderBanner(3);

        expect(screen.getByText(/3 code host connections are syncing/)).toBeTruthy();
        await waitFor(() => {
            expect(screen.getByText(/2 code host connections are syncing/)).toBeTruthy();
        });
        expect(
            screen.getByRole("link", { name: "View connections" }).getAttribute("href"),
        ).toBe("/settings/connections?sortBy=syncedAt&sortOrder=desc");
    });

    test("hides and refreshes when the first sync count reaches zero", async () => {
        const queryClient = renderBanner(3);
        await waitFor(() => {
            expect(api.getConnectionSyncCounts).toHaveBeenCalled();
        });
        api.getConnectionSyncCounts.mockResolvedValueOnce({
            firstTimeSyncingCount: 0,
            failedCount: 1,
            warningCount: 0,
        });

        await act(async () => {
            await queryClient.refetchQueries({
                queryKey: ["connection-sync-counts"],
            });
        });

        await waitFor(() => {
            expect(screen.queryByText(/syncing for the first time/)).toBeNull();
            expect(navigation.refresh).toHaveBeenCalledOnce();
        });
    });
});
