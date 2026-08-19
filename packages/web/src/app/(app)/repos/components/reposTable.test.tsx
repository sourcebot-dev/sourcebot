import { TooltipProvider } from "@/components/ui/tooltip";
import type { CodeHostType } from "@sourcebot/db";
import type { JobLogs } from "@sourcebot/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { RepoIndexingStatusesResponse } from "../types";
import type { Repo } from "./reposTable";

const navigation = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    searchParams: "",
}));
const reposActions = vi.hoisted(() => ({
    indexRepo: vi.fn(),
}));

vi.mock("@/features/repos/actions", () => ({
    indexRepo: reposActions.indexRepo,
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/reposv2",
    useRouter: () => navigation,
    useSearchParams: () => new URLSearchParams(navigation.searchParams),
}));

const { ReposTable } = await import("./reposTable");

const repos: Repo[] = [
    {
        id: 1,
        name: "github.com/acme/first",
        displayName: "acme/first",
        indexedAt: null,
        indexedCommitHash: null,
        latestJob: {
            id: "job-1",
            data: { repoId: 1 },
            status: "IN_PROGRESS",
            errorMessage: null,
            result: null,
        },
        imageUrl: null,
        webUrl: "https://github.com/acme/first",
        codeHostType: "github" as CodeHostType,
    },
    {
        id: 2,
        name: "github.com/acme/second",
        displayName: "acme/second",
        indexedAt: new Date("2026-08-16T12:00:00.000Z"),
        indexedCommitHash: "2222222222222222222222222222222222222222",
        latestJob: null,
        imageUrl: null,
        webUrl: "https://github.com/acme/second",
        codeHostType: "github" as CodeHostType,
    },
];

const renderTable = (data: Repo[] = repos, canRetry = true) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <ReposTable
                    data={data}
                    currentPage={1}
                    pageSize={20}
                    totalCount={data.length}
                    canRetry={canRetry}
                    sortBy="indexedAt"
                    sortOrder="asc"
                />
            </TooltipProvider>
        </QueryClientProvider>,
    );
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    navigation.searchParams = "";
});

describe("ReposTable", () => {
    test("reflects the status filter from the URL", () => {
        navigation.searchParams = "status=failed";

        renderTable([repos[1]]);

        expect(
            screen
                .getByRole("combobox", {
                    name: "Filter repositories by status",
                })
                .textContent,
        ).toContain("Failed");
    });

    test("centers the empty state across the table and hides pagination", () => {
        navigation.searchParams = "status=warning";

        renderTable([]);

        const emptyState = screen.getByText("No repositories with warnings.");
        expect(emptyState.closest("td")?.getAttribute("colspan")).toBe("4");
        expect(screen.queryByText("Page 1 of 1")).toBeNull();
        expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    });

    test("clears search and status filters from the empty state", () => {
        navigation.searchParams = "search=missing&status=failed&page=2&sortBy=indexedAt";

        renderTable([]);

        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

        expect(
            (screen.getByPlaceholderText("Search repositories...") as HTMLInputElement)
                .value,
        ).toBe("");
        expect(navigation.replace).toHaveBeenCalledWith(
            "/reposv2?sortBy=indexedAt",
            { scroll: false },
        );
    });

    test.each(["search=first", "status=warning"])(
        "shows clear filters in the toolbar for %s",
        (searchParams) => {
            navigation.searchParams = searchParams;

            renderTable([repos[1]]);

            expect(
                screen.getByRole("button", { name: "Clear filters" }),
            ).toBeTruthy();
        },
    );

    test("does not offer to clear filters in the unfiltered empty state", () => {
        renderTable([]);

        expect(
            screen.queryByRole("button", { name: "Clear filters" }),
        ).toBeNull();
    });

    test("does not reset pagination when the search value is unchanged", () => {
        navigation.searchParams = "page=2";

        renderTable([repos[1]]);

        expect(navigation.replace).not.toHaveBeenCalled();
    });

    test("focuses repository search when slash is pressed", () => {
        renderTable([repos[1]]);

        const searchInput = screen.getByPlaceholderText("Search repositories...");
        fireEvent.keyDown(document, { key: "/" });

        expect(document.activeElement).toBe(searchInput);
    });

    test("shows a loading indicator while search is being debounced", () => {
        renderTable([repos[1]]);

        fireEvent.change(
            screen.getByPlaceholderText("Search repositories..."),
            { target: { value: "sourcebot" } },
        );

        expect(screen.getByLabelText("Searching repositories")).toBeTruthy();
    });

    test("does not show completed for a repository already indexed on page load", () => {
        renderTable([{
            ...repos[1],
            latestJob: {
                id: "completed-job",
                data: { repoId: 2 },
                status: "COMPLETED",
                errorMessage: null,
                result: null,
            },
        }]);

        expect(screen.queryByText("Completed")).toBeNull();
    });

    test("links only synced repository names to their root browse page", () => {
        renderTable();

        expect(
            screen.queryByRole("link", { name: "acme/first" }),
        ).toBeNull();
        expect(
            screen
                .getByRole("link", { name: "acme/second" })
                .getAttribute("href"),
        ).toBe("/browse/github.com/acme/second/-/tree");
    });

    test("does not link a repository name without a synced commit", () => {
        renderTable([{
            ...repos[1],
            indexedCommitHash: null,
        }]);

        expect(
            screen.queryByRole("link", { name: "acme/second" }),
        ).toBeNull();
        expect(screen.getByText("acme/second")).toBeTruthy();
    });

    test("shows repository actions to everyone and sync only to owners", () => {
        const { unmount } = renderTable([repos[1]], false);

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        expect(screen.queryByRole("menuitem", { name: "Sync" })).toBeNull();
        expect(
            screen
                .getByRole("menuitem", { name: "Open in GitHub" })
                .getAttribute("href"),
        ).toBe("https://github.com/acme/second");

        unmount();
        renderTable([repos[1]]);
        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        expect(screen.getByRole("menuitem", { name: "Sync" })).toBeTruthy();
    });

    test("shows client-only syncing after an owner explicitly schedules a sync", async () => {
        reposActions.indexRepo.mockResolvedValue({ jobId: "interactive-job" });
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
        renderTable([repos[1]]);

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

        await waitFor(() => {
            expect(reposActions.indexRepo).toHaveBeenCalledWith(2);
            expect(screen.getByText("Syncing")).toBeTruthy();
            expect(fetch).toHaveBeenCalledOnce();
        });

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        expect(
            screen
                .getByRole("menuitem", { name: "Sync" })
                .getAttribute("aria-disabled"),
        ).toBe("true");
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test("shows syncing for an indexed repository with an active latest job", async () => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
        renderTable([{
            ...repos[1],
            latestJob: {
                id: "active-reindex-job",
                data: { repoId: repos[1].id },
                status: "IN_PROGRESS",
                errorMessage: null,
                result: null,
            },
        }]);

        expect(screen.getByText("Syncing")).toBeTruthy();
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        expect(
            screen
                .getByRole("menuitem", { name: "Sync" })
                .getAttribute("aria-disabled"),
        ).toBe("true");
    });

    test("preserves a completed sync timestamp when another sync starts", async () => {
        const firstRepo: Repo = {
            ...repos[0],
            indexedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            indexedCommitHash: "1111111111111111111111111111111111111111",
            latestJob: null,
        };
        reposActions.indexRepo
            .mockResolvedValueOnce({ jobId: "first-interactive-job" })
            .mockResolvedValueOnce({ jobId: "second-interactive-job" });
        const firstCompletedResponse: RepoIndexingStatusesResponse = {
            repositories: [{
                repoId: 1,
                indexedAt: new Date().toISOString(),
                indexedCommitHash: "3333333333333333333333333333333333333333",
                latestJob: {
                    id: "first-interactive-job",
                    data: { repoId: 1 },
                    status: "COMPLETED",
                    errorMessage: null,
                    result: null,
                },
            }],
        };
        vi.stubGlobal(
            "fetch",
            vi.fn()
                .mockResolvedValueOnce(Response.json(firstCompletedResponse))
                .mockImplementation(() => new Promise<Response>(() => {})),
        );
        renderTable([firstRepo, repos[1]]);

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/first",
        }), { key: "Enter" });
        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

        await waitFor(() => {
            const firstRow = screen
                .getByRole("link", { name: "acme/first" })
                .closest("tr");
            expect(firstRow && within(firstRow).getByText("just now")).toBeTruthy();
        });

        fireEvent.keyDown(screen.getByRole("button", {
            name: "Open actions for acme/second",
        }), { key: "Enter" });
        fireEvent.click(screen.getByRole("menuitem", { name: "Sync" }));

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        const firstRow = screen
            .getByRole("link", { name: "acme/first" })
            .closest("tr");
        expect(firstRow && within(firstRow).getByText("just now")).toBeTruthy();
    });

    test("shows the impact and worker error for a warning", () => {
        renderTable([{
            ...repos[1],
            latestJob: {
                id: "warning-job",
                data: { repoId: 2 },
                status: "FAILED",
                errorMessage: "The remote repository could not be reached",
                result: null,
            },
        }]);

        fireEvent.click(screen.getByRole("button", {
            name: "View warning details for acme/second",
        }));

        expect(screen.getByText("Latest sync failed")).toBeTruthy();
        expect(screen.getByText(/results may be stale/)).toBeTruthy();
        expect(
            screen.getByText("The remote repository could not be reached"),
        ).toBeTruthy();
        expect(screen.getByText("warning-job")).toBeTruthy();
    });

    test("shows the impact and worker error for a failed repository", () => {
        renderTable([{
            ...repos[0],
            latestJob: {
                ...repos[0].latestJob!,
                status: "FAILED",
                errorMessage: "Authentication failed while cloning",
                result: null,
            },
        }]);

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for acme/first",
        }));

        expect(screen.getByText("Repository sync failed")).toBeTruthy();
        expect(screen.getByText(/not available in search/)).toBeTruthy();
        expect(
            screen.getByText("Authentication failed while cloning"),
        ).toBeTruthy();
        expect(screen.getByText("job-1")).toBeTruthy();
    });

    test("opens retained repository indexing logs", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const jobLogs: JobLogs = {
            count: 1,
            logs: [{
                version: 1,
                timestamp: "2026-08-18T23:00:00.000Z",
                level: "error",
                message: "Repository indexing failed",
                attempt: 2,
            }],
        };
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValueOnce(Response.json(jobLogs)),
        );
        renderTable([{
            ...repos[0],
            latestJob: {
                ...repos[0].latestJob!,
                status: "FAILED",
                errorMessage: "Authentication failed while cloning",
                result: null,
            },
        }]);

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for acme/first",
        }));
        fireEvent.click(screen.getByRole("button", { name: "View logs" }));

        const dialog = await screen.findByRole("dialog");
        await waitFor(() => {
            expect(dialog.textContent).toContain("Repository indexing failed");
        });
        fireEvent.click(within(dialog).getByRole("button", {
            name: "Copy all",
        }));
        await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
        expect(writeText.mock.calls[0]?.[0]).toContain(
            "Repository indexing failed",
        );
        expect(fetch).toHaveBeenCalledWith(
            "/api/job-logs",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    queue: "repo-index",
                    jobId: "job-1",
                }),
            }),
        );
    });

    test("hides job log access from non-owners", () => {
        renderTable([{
            ...repos[0],
            latestJob: {
                ...repos[0].latestJob!,
                status: "FAILED",
                errorMessage: "Authentication failed while cloning",
                result: null,
            },
        }], false);

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for acme/first",
        }));

        expect(
            screen.queryByRole("button", { name: "View logs" }),
        ).toBeNull();
    });

    test("schedules a retry and transitions an unindexed repository to syncing", async () => {
        reposActions.indexRepo.mockResolvedValue({ jobId: "retry-job" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
            repositories: [{
                repoId: 1,
                indexedAt: null,
                indexedCommitHash: null,
                latestJob: {
                    id: "job-1",
                    data: { repoId: 1 },
                    status: "FAILED",
                    errorMessage: "Authentication failed while cloning",
                    result: null,
                },
            }],
        } satisfies RepoIndexingStatusesResponse)));
        renderTable([{
            ...repos[0],
            latestJob: {
                ...repos[0].latestJob!,
                status: "FAILED",
                errorMessage: "Authentication failed while cloning",
                result: null,
            },
        }]);

        fireEvent.click(screen.getByRole("button", {
            name: "View failed details for acme/first",
        }));
        fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));

        await waitFor(() => {
            expect(reposActions.indexRepo).toHaveBeenCalledWith(1);
            expect(screen.getByText("Syncing")).toBeTruthy();
            expect(fetch).toHaveBeenCalledOnce();
        });
        expect(screen.queryByText("Repository sync failed")).toBeNull();
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test("updates a completed repository in place without refreshing or reordering", async () => {
        let resolveRequest: ((response: Response) => void) | undefined;
        vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
            resolveRequest = resolve;
        })));

        renderTable();

        expect(screen.getByText("Syncing")).toBeTruthy();
        const initialRows = within(screen.getByRole("table")).getAllByRole("row");
        expect(within(initialRows[1]).getByText("acme/first")).toBeTruthy();
        expect(within(initialRows[2]).getByText("acme/second")).toBeTruthy();

        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        const response: RepoIndexingStatusesResponse = {
            repositories: [{
                repoId: 1,
                indexedAt: "2026-08-17T12:00:00.000Z",
                indexedCommitHash: "1111111111111111111111111111111111111111",
                latestJob: {
                    id: "job-1",
                    data: { repoId: 1 },
                    status: "COMPLETED",
                    errorMessage: null,
                    result: null,
                },
            }],
        };
        await act(async () => {
            resolveRequest?.(Response.json(response));
        });

        await waitFor(() => expect(screen.getByText("Completed")).toBeTruthy());
        expect(screen.queryByText("Syncing")).toBeNull();
        const updatedRows = within(screen.getByRole("table")).getAllByRole("row");
        expect(within(updatedRows[1]).getByText("acme/first")).toBeTruthy();
        expect(
            within(updatedRows[1])
                .getByRole("link", { name: "acme/first" })
                .getAttribute("href"),
        ).toBe("/browse/github.com/acme/first/-/tree");
        expect(
            within(updatedRows[1])
                .getByRole("link", { name: "1111111" })
                .getAttribute("href"),
        ).toBe(
            "/browse/github.com/acme/first/-/commit/1111111111111111111111111111111111111111",
        );
        expect(within(updatedRows[1]).queryByText("-")).toBeNull();
        expect(within(updatedRows[2]).getByText("acme/second")).toBeTruthy();
        expect(navigation.refresh).not.toHaveBeenCalled();
    });

    test("polls a syncing repository whose latest job is missing", async () => {
        const response: RepoIndexingStatusesResponse = {
            repositories: [{
                repoId: 1,
                indexedAt: null,
                indexedCommitHash: null,
                latestJob: {
                    id: "job-1",
                    data: { repoId: 1 },
                    status: "FAILED",
                    errorMessage: "Indexing failed",
                    result: null,
                },
            }],
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));

        renderTable([{ ...repos[0], latestJob: null }]);

        expect(screen.getByText("Syncing")).toBeTruthy();
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        await waitFor(() => expect(screen.getByText("Failed")).toBeTruthy());
        expect(screen.queryByText("Syncing")).toBeNull();
        expect(navigation.refresh).not.toHaveBeenCalled();
    });
});
