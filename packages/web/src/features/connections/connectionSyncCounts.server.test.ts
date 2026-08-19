import type { WorkloadJob } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const findMany = vi.fn();
    return {
        findMany,
        getJobs: vi.fn(),
        prisma: {
            connection: { findMany },
        },
    };
});

vi.mock("server-only", () => ({}));
vi.mock("@/middleware/withAuth", () => ({
    withAuth: (fn: (context: unknown) => unknown) => fn({
        org: { id: 42 },
        prisma: mocks.prisma,
        role: "OWNER",
    }),
}));
vi.mock("@/lib/bullmqClient", () => ({
    getBullMQClient: () => ({
        getJobs: mocks.getJobs,
    }),
}));

const { getConnectionSyncCounts } = await import(
    "./connectionSyncCounts.server"
);

const job = (
    id: string,
    connectionId: number,
    status: WorkloadJob<"connection-sync">["status"],
    result: WorkloadJob<"connection-sync">["result"] = null,
): WorkloadJob<"connection-sync"> => ({
    id,
    data: { connectionId },
    status,
    errorMessage: status === "FAILED" ? "sync failed" : null,
    result,
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getConnectionSyncCounts", () => {
    test("classifies never-synced failures separately from warnings", async () => {
        mocks.findMany.mockResolvedValue([
            { id: 1, syncedAt: null, latestSyncJobId: "failed-first-sync", firstSyncJobFinishedAt: new Date() },
            { id: 2, syncedAt: new Date(), latestSyncJobId: "failed-resync", firstSyncJobFinishedAt: new Date() },
            { id: 3, syncedAt: new Date(), latestSyncJobId: "partial-success", firstSyncJobFinishedAt: new Date() },
            { id: 4, syncedAt: new Date(), latestSyncJobId: "success", firstSyncJobFinishedAt: new Date() },
            { id: 5, syncedAt: null, latestSyncJobId: "mismatched-job", firstSyncJobFinishedAt: new Date() },
            { id: 6, syncedAt: null, latestSyncJobId: null, firstSyncJobFinishedAt: null },
            { id: 7, syncedAt: null, latestSyncJobId: "active-first-sync", firstSyncJobFinishedAt: null },
        ]);
        mocks.getJobs.mockResolvedValue(new Map([
            ["failed-first-sync", job("failed-first-sync", 1, "FAILED")],
            ["failed-resync", job("failed-resync", 2, "FAILED")],
            ["partial-success", job(
                "partial-success",
                3,
                "COMPLETED",
                { outcome: "PARTIAL_SUCCESS", reasons: [] },
            )],
            ["success", job("success", 4, "COMPLETED", { outcome: "SUCCESS" })],
            ["mismatched-job", job("mismatched-job", 999, "FAILED")],
            ["active-first-sync", job("active-first-sync", 7, "IN_PROGRESS")],
        ]));

        await expect(getConnectionSyncCounts()).resolves.toEqual({
            firstTimeSyncingCount: 2,
            failedCount: 1,
            warningCount: 2,
        });
        expect(mocks.findMany).toHaveBeenCalledWith({
            where: { orgId: 42 },
            select: {
                id: true,
                syncedAt: true,
                latestSyncJobId: true,
                firstSyncJobFinishedAt: true,
            },
        });
        expect(mocks.getJobs).toHaveBeenCalledWith(
            expect.objectContaining({ name: "connection-sync" }),
            [
                "failed-first-sync",
                "failed-resync",
                "partial-success",
                "success",
                "mismatched-job",
                "active-first-sync",
            ],
        );
    });
});
