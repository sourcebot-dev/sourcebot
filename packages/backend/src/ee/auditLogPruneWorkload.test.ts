import type { PrismaClient } from "@sourcebot/db";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@sourcebot/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@sourcebot/shared")>()),
    createLogger: vi.fn(() => mocks.logger),
}));

import { createAuditLogPruneWorkload } from "./auditLogPruneWorkload.js";

const db = {
    audit: {
        findMany: mocks.findMany,
        deleteMany: mocks.deleteMany,
    },
} as unknown as PrismaClient;

const logger = mocks.logger;

const processWorkload = ({
    enabled = true,
    retentionDays = 180,
}: {
    enabled?: boolean;
    retentionDays?: number;
} = {}) =>
    createAuditLogPruneWorkload({ db, enabled, retentionDays }).process({
        data: {},
        jobId: "job-1",
        attemptsMade: 0,
        maxAttempts: 2,
        prisma: db,
        signal: new AbortController().signal,
        updateProgress: vi.fn(),
        trigger: vi.fn(),
    });

describe("auditLogPruneWorkload", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.findMany.mockResolvedValue([]);
        mocks.deleteMany.mockResolvedValue({ count: 0 });
    });

    test("declares a daily scheduled workload", () => {
        const workload = createAuditLogPruneWorkload({
            db,
            enabled: true,
            retentionDays: 180,
        });

        expect(workload.queueSpec.name).toBe("audit-log-prune");
        expect(workload.concurrency).toBe(1);
        expect(workload.schedule).toEqual({
            interval: "1d",
            data: {},
            options: { priority: 10 },
        });
    });

    test.each([
        { enabled: false, retentionDays: 180 },
        { enabled: true, retentionDays: 0 },
    ])(
        "does not schedule or prune when disabled: %o",
        async ({ enabled, retentionDays }) => {
            const workload = createAuditLogPruneWorkload({
                db,
                enabled,
                retentionDays,
            });

            expect(workload.schedule).toBeUndefined();
            await expect(
                processWorkload({ enabled, retentionDays }),
            ).resolves.toEqual({ deleted: 0 });
            expect(mocks.findMany).not.toHaveBeenCalled();
            expect(mocks.deleteMany).not.toHaveBeenCalled();
        },
    );

    test("deletes audit logs older than the retention period", async () => {
        vi.spyOn(Date, "now").mockReturnValue(
            new Date("2026-08-10T12:00:00.000Z").getTime(),
        );
        mocks.findMany.mockResolvedValue([
            { id: "audit-1" },
            { id: "audit-2" },
        ]);
        mocks.deleteMany.mockResolvedValue({ count: 2 });

        await expect(processWorkload()).resolves.toEqual({ deleted: 2 });

        expect(mocks.findMany).toHaveBeenCalledWith({
            where: {
                timestamp: {
                    lt: new Date("2026-02-11T12:00:00.000Z"),
                },
            },
            select: { id: true },
            take: 10_000,
        });
        expect(mocks.deleteMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["audit-1", "audit-2"] },
            },
        });
        expect(logger.debug).toHaveBeenCalledWith(
            "Pruned 2 audit log record(s).",
        );
    });

    test("continues deleting full batches", async () => {
        const firstBatch = Array.from({ length: 10_000 }, (_, index) => ({
            id: `audit-${index}`,
        }));
        mocks.findMany
            .mockResolvedValueOnce(firstBatch)
            .mockResolvedValueOnce([{ id: "audit-last" }]);
        mocks.deleteMany
            .mockResolvedValueOnce({ count: 10_000 })
            .mockResolvedValueOnce({ count: 1 });

        await expect(processWorkload()).resolves.toEqual({ deleted: 10_001 });

        expect(mocks.findMany).toHaveBeenCalledTimes(2);
        expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
    });

    test("propagates database failures so BullMQ can retry", async () => {
        const error = new Error("Database unavailable");
        mocks.findMany.mockRejectedValueOnce(error);

        await expect(processWorkload()).rejects.toBe(error);
    });
});
