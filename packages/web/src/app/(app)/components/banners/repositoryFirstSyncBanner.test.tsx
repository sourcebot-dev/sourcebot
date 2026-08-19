import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
const api = vi.hoisted(() => ({ getRepositorySyncCounts: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => navigation,
}));

vi.mock("@/app/api/(client)/client", () => ({
    getRepositorySyncCounts: api.getRepositorySyncCounts,
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

const { RepositoryFirstSyncBanner } = await import(
    "./repositoryFirstSyncBanner"
);

const renderBanner = (firstTimeSyncingCount: number) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    render(
        <QueryClientProvider client={queryClient}>
            <RepositoryFirstSyncBanner
                id="repositoryFirstSync"
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
    api.getRepositorySyncCounts.mockResolvedValue({
        firstTimeSyncingCount: 3,
        failedCount: 0,
        warningCount: 0,
    });
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("RepositoryFirstSyncBanner", () => {
    test("updates the displayed count from the latest status", async () => {
        api.getRepositorySyncCounts.mockResolvedValueOnce({
            firstTimeSyncingCount: 2,
            failedCount: 0,
            warningCount: 0,
        });
        renderBanner(3);

        expect(screen.getByText(/3 repositories are syncing/)).toBeTruthy();
        await waitFor(() => {
            expect(screen.getByText(/2 repositories are syncing/)).toBeTruthy();
        });
    });

    test("hides and refreshes when the first sync count reaches zero", async () => {
        const queryClient = renderBanner(3);
        await waitFor(() => {
            expect(api.getRepositorySyncCounts).toHaveBeenCalled();
        });
        api.getRepositorySyncCounts.mockResolvedValueOnce({
            firstTimeSyncingCount: 0,
            failedCount: 1,
            warningCount: 0,
        });

        await act(async () => {
            await queryClient.refetchQueries({
                queryKey: ["repository-sync-counts"],
            });
        });

        await waitFor(() => {
            expect(screen.queryByText(/syncing for the first time/)).toBeNull();
            expect(navigation.refresh).toHaveBeenCalledOnce();
        });
    });
});
