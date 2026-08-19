import type { ConnectionType } from "@sourcebot/db";
import type { JobLogs } from "@sourcebot/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ConnectionSyncStatusesResponse } from "../types";
import type { Connection } from "./connectionsTable";

const navigation = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    searchParams: "",
}));
const connectionActions = vi.hoisted(() => ({
    syncConnection: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    usePathname: () => "/settings/connectionsv2",
    useRouter: () => navigation,
    useSearchParams: () => new URLSearchParams(navigation.searchParams),
}));

vi.mock("@/features/connections/actions", () => ({
    syncConnection: connectionActions.syncConnection,
}));

vi.mock("@/components/hooks/use-toast", () => ({
    useToast: () => ({ toast }),
}));

const { ConnectionsTable } = await import("./connectionsTable");

const connections: Connection[] = [
    {
        id: 1,
        name: "Primary GitHub",
        connectionType: "github" as ConnectionType,
        syncedAt: new Date("2026-08-18T12:00:00.000Z"),
        latestJob: null,
    },
    {
        id: 2,
        name: "Internal GitLab",
        connectionType: "gitlab" as ConnectionType,
        syncedAt: null,
        latestJob: null,
    },
];

type RenderTableOptions = {
    data?: Connection[];
    currentPage?: number;
    totalCount?: number;
    sortBy?: "name" | "syncedAt";
    sortOrder?: "asc" | "desc";
};

const renderTable = (options: RenderTableOptions = {}) => {
    const data = options.data ?? connections;
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <ConnectionsTable
                    data={data}
                    currentPage={options.currentPage ?? 1}
                    pageSize={20}
                    totalCount={options.totalCount ?? data.length}
                    sortBy={options.sortBy ?? "name"}
                    sortOrder={options.sortOrder ?? "asc"}
                />
            </TooltipProvider>
        </QueryClientProvider>,
    );
};

beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    navigation.searchParams = "";
});

describe("ConnectionsTable", () => {
    test("renders connection names without detail-page links", () => {
        renderTable();

        expect(screen.getByText("Primary GitHub")).toBeTruthy();
        expect(
            screen.queryByRole("link", { name: "Primary GitHub" }),
        ).toBeNull();
    });

    test("uses URL-driven server pagination", () => {
        renderTable({ totalCount: 29 });

        expect(screen.getByText("Showing 1-20 of 29")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Next" }));

        expect(navigation.push).toHaveBeenCalledWith(
            "/settings/connectionsv2?page=2",
        );
    });

    test("toggles server-side name sorting", () => {
        renderTable();

        fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));

        expect(navigation.push).toHaveBeenCalledWith(
            "/settings/connectionsv2?sortOrder=desc",
        );
    });

    test("focuses connection search when slash is pressed", () => {
        renderTable();

        const searchInput = screen.getByPlaceholderText("Search connections...");
        fireEvent.keyDown(document, { key: "/" });

        expect(document.activeElement).toBe(searchInput);
    });

    test("shows and polls an explicitly scheduled sync", async () => {
        connectionActions.syncConnection.mockResolvedValue({ jobId: "job-1" });
        renderTable();

        fireEvent.keyDown(
            screen.getByRole("button", {
                name: "Open actions for Primary GitHub",
            }),
            { key: "Enter" },
        );

        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));
        await waitFor(() => {
            expect(connectionActions.syncConnection).toHaveBeenCalledWith(1);
            expect(screen.getByText("Syncing")).toBeTruthy();
            expect(fetch).toHaveBeenCalledOnce();
        });

        fireEvent.keyDown(
            screen.getByRole("button", {
                name: "Open actions for Primary GitHub",
            }),
            { key: "Enter" },
        );
        expect(
            screen
                .getByRole("menuitem", { name: "Sync" })
                .getAttribute("aria-disabled"),
        ).toBe("true");
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test("updates an actively syncing connection in place", async () => {
        let resolveRequest: ((response: Response) => void) | undefined;
        vi.mocked(fetch).mockImplementation(() =>
            new Promise<Response>((resolve) => {
                resolveRequest = resolve;
            })
        );
        const activeConnection: Connection = {
            ...connections[0],
            latestJob: {
                id: "active-job",
                data: { connectionId: connections[0].id },
                status: "IN_PROGRESS",
                errorMessage: null,
                result: null,
            },
        };
        renderTable({ data: [activeConnection, connections[1]] });

        expect(screen.getByText("Syncing")).toBeTruthy();
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

        const response: ConnectionSyncStatusesResponse = {
            connections: [{
                connectionId: activeConnection.id,
                syncedAt: new Date().toISOString(),
                latestJob: {
                    ...activeConnection.latestJob!,
                    status: "COMPLETED",
                    result: { outcome: "SUCCESS" },
                },
            }],
        };
        await act(async () => {
            resolveRequest?.(Response.json(response));
        });

        await waitFor(() => expect(screen.getByText("Completed")).toBeTruthy());
        expect(screen.queryByText("Syncing")).toBeNull();
        const rows = within(screen.getByRole("table")).getAllByRole("row");
        expect(within(rows[1]).getByText("Primary GitHub")).toBeTruthy();
        expect(within(rows[1]).getByText("just now")).toBeTruthy();
        expect(within(rows[2]).getByText("Internal GitLab")).toBeTruthy();
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test("preserves the latest synced timestamp when scheduling another sync", async () => {
        const previousSyncedAt = new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1_000,
        );
        const completedAt = new Date();
        const connection = {
            ...connections[0],
            syncedAt: previousSyncedAt,
        };
        connectionActions.syncConnection
            .mockResolvedValueOnce({ jobId: "first-job" })
            .mockResolvedValueOnce({ jobId: "second-job" });
        vi.mocked(fetch)
            .mockResolvedValueOnce(Response.json({
                connections: [{
                    connectionId: connection.id,
                    syncedAt: completedAt.toISOString(),
                    latestJob: {
                        id: "first-job",
                        data: { connectionId: connection.id },
                        status: "COMPLETED",
                        errorMessage: null,
                        result: { outcome: "SUCCESS" },
                    },
                }],
            } satisfies ConnectionSyncStatusesResponse))
            .mockImplementation(() => new Promise<Response>(() => {}));
        renderTable({ data: [connection] });

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for Primary GitHub",
        }), { key: "Enter" });
        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

        await waitFor(() => expect(screen.getByText("just now")).toBeTruthy());

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for Primary GitHub",
        }), { key: "Enter" });
        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(screen.getByText("Syncing")).toBeTruthy();
        });
        expect(screen.getByText("just now")).toBeTruthy();
        expect(screen.queryByText("2 days ago")).toBeNull();
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test.each([
        ["PENDING", "Syncing"],
        ["IN_PROGRESS", "Syncing"],
        ["FAILED", "Failed"],
    ] as const)("renders a %s sync annotation", (status, label) => {
        renderTable({
            data: [{
                ...connections[0],
                latestJob: {
                    id: "job-1",
                    data: { connectionId: connections[0].id },
                    status,
                    errorMessage: status === "FAILED" ? "Sync failed" : null,
                    result: null,
                },
            }],
        });

        expect(screen.getByText(label)).toBeTruthy();
    });

    test("shows structured discovery issues for a partial success", () => {
        renderTable({
            data: [{
                ...connections[0],
                latestJob: {
                    id: "job-1",
                    data: { connectionId: connections[0].id },
                    status: "COMPLETED",
                    errorMessage: null,
                    result: {
                        outcome: "PARTIAL_SUCCESS",
                        reasons: [{
                            code: "NOT_FOUND_OR_INACCESSIBLE",
                            effect: "TARGET_SKIPPED",
                            subject: {
                                kind: "repository",
                                value: "acme/private",
                            },
                            message: "Not found or inaccessible",
                        }],
                    },
                },
            }],
        });

        const warning = screen.getByText("Warning");
        expect(warning).toBeTruthy();
        expect(warning.closest("td")).toBe(
            screen.getByText("Primary GitHub").closest("td"),
        );
        fireEvent.click(screen.getByRole("button", {
            name: "View warning details for Primary GitHub",
        }));

        expect(
            screen.getByText("Connection sync completed with warnings"),
        ).toBeTruthy();
        expect(screen.getByText("repository")).toBeTruthy();
        expect(screen.getByText("acme/private")).toBeTruthy();
        expect(screen.getByText("Not found or inaccessible")).toBeTruthy();
        expect(screen.getByText("job-1")).toBeTruthy();
    });

    test("shows the worker error for a failed sync and supports retry", async () => {
        connectionActions.syncConnection.mockResolvedValue({
            jobId: "retry-job",
        });
        renderTable({
            data: [{
                ...connections[0],
                latestJob: {
                    id: "failed-job",
                    data: { connectionId: connections[0].id },
                    status: "FAILED",
                    errorMessage: "Authentication failed while discovering repositories",
                    result: null,
                },
            }],
        });

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for Primary GitHub",
        }));

        expect(screen.getByText("Connection sync failed")).toBeTruthy();
        expect(
            screen.getByText(
                "Authentication failed while discovering repositories",
            ),
        ).toBeTruthy();
        expect(screen.getByText("failed-job")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));

        await waitFor(() => {
            expect(connectionActions.syncConnection).toHaveBeenCalledWith(1);
            expect(screen.getByText("Syncing")).toBeTruthy();
        });
        expect(screen.queryByText("Connection sync failed")).toBeNull();
    });

    test("opens retained job logs in a large dialog", async () => {
        const jobLogs: JobLogs = {
            count: 3,
            logs: [
                {
                    version: 1,
                    timestamp: "2026-08-18T23:00:00.000Z",
                    level: "info",
                    message: "Earlier attempt failed",
                    attempt: 1,
                },
                {
                    version: 1,
                    timestamp: "2026-08-18T23:00:01.000Z",
                    level: "info",
                    message: "Starting repository discovery",
                    attempt: 2,
                },
                {
                    version: 1,
                    timestamp: "2026-08-18T23:00:02.000Z",
                    level: "error",
                    message: "Repository discovery failed",
                    attempt: 2,
                    fields: { provider: "gitlab" },
                },
            ],
        };
        vi.mocked(fetch).mockResolvedValueOnce(Response.json(jobLogs));
        renderTable({
            data: [{
                ...connections[0],
                latestJob: {
                    id: "failed-job",
                    data: { connectionId: connections[0].id },
                    status: "FAILED",
                    errorMessage: "fetch failed",
                    result: null,
                },
            }],
        });

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for Primary GitHub",
        }));
        fireEvent.click(screen.getByRole("button", { name: "View logs" }));

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText("Job logs")).toBeTruthy();
        await waitFor(() => {
            expect(dialog.textContent).toContain("Starting repository discovery");
            expect(dialog.textContent).toContain("Repository discovery failed");
            expect(dialog.textContent).toContain("gitlab");
        });
        expect(dialog.textContent).not.toContain("Earlier attempt failed");
        expect(fetch).toHaveBeenCalledWith(
            "/api/job-logs",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    queue: "connection-sync",
                    jobId: "failed-job",
                }),
            }),
        );
    });

    test("does not annotate a successful sync", () => {
        renderTable({
            data: [{
                ...connections[0],
                latestJob: {
                    id: "job-1",
                    data: { connectionId: connections[0].id },
                    status: "COMPLETED",
                    errorMessage: null,
                    result: { outcome: "SUCCESS" },
                },
            }],
        });

        expect(screen.queryByText("Syncing")).toBeNull();
        expect(screen.queryByText("Failed")).toBeNull();
        expect(screen.queryByText("Warning")).toBeNull();
        expect(screen.queryByText("Completed")).toBeNull();
    });
});
