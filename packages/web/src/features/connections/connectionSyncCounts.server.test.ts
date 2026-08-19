import type { WorkloadJob } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    getJobs: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/prisma", () => ({
    __unsafePrisma: {
        connection: {
            findMany: mocks.findMany,
        },
    },
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
            { id: 1, syncedAt: null, latestSyncJobId: "failed-first-sync" },
            { id: 2, syncedAt: new Date(), latestSyncJobId: "failed-resync" },
            { id: 3, syncedAt: new Date(), latestSyncJobId: "partial-success" },
            { id: 4, syncedAt: new Date(), latestSyncJobId: "success" },
            { id: 5, syncedAt: null, latestSyncJobId: "mismatched-job" },
            { id: 6, syncedAt: null, latestSyncJobId: null },
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
        ]));

        await expect(getConnectionSyncCounts(42)).resolves.toEqual({
            failedCount: 1,
            warningCount: 2,
        });
        expect(mocks.findMany).toHaveBeenCalledWith({
            where: { orgId: 42 },
            select: {
                id: true,
                syncedAt: true,
                latestSyncJobId: true,
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
            ],
        );
    });
});
