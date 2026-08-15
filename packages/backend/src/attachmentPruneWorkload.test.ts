import type { PrismaClient } from "@sourcebot/db";
import type { StorageBackend } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    updateMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    storageDelete: vi.fn(),
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

import { createAttachmentPruneWorkload } from "./attachmentPruneWorkload.js";

const db = {
    attachment: {
        updateMany: mocks.updateMany,
        findMany: mocks.findMany,
        deleteMany: mocks.deleteMany,
    },
} as unknown as PrismaClient;

const storage = {
    delete: mocks.storageDelete,
} as unknown as StorageBackend;

const logger = mocks.logger;

const processWorkload = (ttlHours = 24) =>
    createAttachmentPruneWorkload({ db, storage, ttlHours }).process({
        data: {},
        jobId: "job-1",
        attemptsMade: 0,
        maxAttempts: 2,
        prisma: db,
        signal: new AbortController().signal,
        updateProgress: vi.fn(),
        trigger: vi.fn(),
    });

describe("attachmentPruneWorkload", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.updateMany.mockResolvedValue({ count: 0 });
        mocks.findMany.mockResolvedValue([]);
        mocks.deleteMany.mockResolvedValue({ count: 0 });
        mocks.storageDelete.mockResolvedValue(undefined);
    });

    test("declares an hourly scheduled workload", () => {
        const workload = createAttachmentPruneWorkload({
            db,
            storage,
            ttlHours: 24,
        });

        expect(workload.queueSpec.name).toBe("attachment-prune");
        expect(workload.concurrency).toBe(1);
        expect(workload.schedule).toEqual({
            interval: "1h",
            data: {},
            options: { priority: 10 },
        });
    });

    test("does not schedule or prune when the TTL is disabled", async () => {
        const workload = createAttachmentPruneWorkload({
            db,
            storage,
            ttlHours: 0,
        });

        expect(workload.schedule).toBeUndefined();
        await expect(processWorkload(0)).resolves.toEqual({
            pendingClaimed: 0,
            committedClaimed: 0,
            reclaimed: 0,
        });
        expect(mocks.updateMany).not.toHaveBeenCalled();
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    test("claims expired orphans and reclaims their tombstones", async () => {
        vi.spyOn(Date, "now").mockReturnValue(
            new Date("2026-08-10T12:00:00.000Z").getTime(),
        );
        mocks.updateMany
            .mockResolvedValueOnce({ count: 2 })
            .mockResolvedValueOnce({ count: 1 });
        mocks.findMany.mockResolvedValue([
            { id: "attachment-1", storageKey: "key-1" },
            { id: "attachment-2", storageKey: "key-2" },
        ]);
        mocks.deleteMany.mockResolvedValue({ count: 2 });

        await expect(processWorkload()).resolves.toEqual({
            pendingClaimed: 2,
            committedClaimed: 1,
            reclaimed: 2,
        });

        const cutoff = new Date("2026-08-09T12:00:00.000Z");
        expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
            where: {
                status: "PENDING",
                createdAt: { lt: cutoff },
            },
            data: { status: "DELETING" },
        });
        expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
            where: {
                status: "COMMITTED",
                createdAt: { lt: cutoff },
                chats: { none: {} },
            },
            data: { status: "DELETING" },
        });
        expect(mocks.storageDelete).toHaveBeenCalledWith("key-1");
        expect(mocks.storageDelete).toHaveBeenCalledWith("key-2");
        expect(mocks.deleteMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["attachment-1", "attachment-2"] },
                status: "DELETING",
            },
        });
    });

    test("leaves tombstones whose bytes could not be deleted", async () => {
        mocks.findMany.mockResolvedValue([
            { id: "attachment-1", storageKey: "key-1" },
            { id: "attachment-2", storageKey: "key-2" },
        ]);
        mocks.storageDelete.mockImplementation(async (key: string) => {
            if (key === "key-2") {
                throw new Error("Storage unavailable");
            }
        });
        mocks.deleteMany.mockResolvedValue({ count: 1 });

        await expect(processWorkload()).resolves.toEqual({
            pendingClaimed: 0,
            committedClaimed: 0,
            reclaimed: 1,
        });

        expect(mocks.deleteMany).toHaveBeenCalledWith({
            where: {
                id: { in: ["attachment-1"] },
                status: "DELETING",
            },
        });
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("attachment-2"),
        );
    });

    test("propagates database failures so BullMQ can retry", async () => {
        const error = new Error("Database unavailable");
        mocks.updateMany.mockRejectedValueOnce(error);

        await expect(processWorkload()).rejects.toBe(error);
    });
});
