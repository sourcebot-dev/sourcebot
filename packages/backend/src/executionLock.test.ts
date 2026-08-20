import type { Redis } from "ioredis";
import Redlock, {
    ExecutionError,
    ResourceLockedError,
    type ExecutionStats,
    type RedlockAbortSignal,
} from "redlock";
import { describe, expect, test, vi } from "vitest";
import { RedlockExecutionLockRunner } from "./executionLock.js";

const LOCK_DURATION_MS = 60_000;

const executionError = (attemptError: Error): ExecutionError => {
    const client = {} as Redis;
    const stats: ExecutionStats = {
        membershipSize: 1,
        quorumSize: 1,
        votesFor: new Set(),
        votesAgainst: new Map([[client, attemptError]]),
    };

    return new ExecutionError("Unable to acquire lock", [
        Promise.resolve(stats),
    ]);
};

const contentionError = (): ExecutionError =>
    executionError(new ResourceLockedError("Resource is locked"));

const lockSignal = (controller = new AbortController()) =>
    controller.signal as RedlockAbortSignal;

describe("RedlockExecutionLockRunner", () => {
    test("waits and retries after lock contention", async () => {
        const using = vi
            .fn()
            .mockRejectedValueOnce(contentionError())
            .mockImplementationOnce(
                async (_resources, _duration, _settings, routine) =>
                    routine(lockSignal()),
            );
        const runner = new RedlockExecutionLockRunner(
            { using } as unknown as Redlock,
            { retryDelayMs: 0, retryJitterMs: 0 },
        );

        await expect(
            runner.using(
                "resource:1",
                LOCK_DURATION_MS,
                new AbortController().signal,
                async () => "complete",
            ),
        ).resolves.toBe("complete");

        expect(using).toHaveBeenCalledTimes(2);
        expect(using).toHaveBeenLastCalledWith(
            ["resource:1"],
            LOCK_DURATION_MS,
            { retryCount: 0 },
            expect.any(Function),
        );
    });

    test("does not retry an error thrown after lock acquisition", async () => {
        const error = contentionError();
        const using = vi.fn(async (_resources, _duration, _settings, routine) =>
            routine(lockSignal()),
        );
        const runner = new RedlockExecutionLockRunner(
            { using } as unknown as Redlock,
            { retryDelayMs: 0, retryJitterMs: 0 },
        );

        await expect(
            runner.using(
                "resource:1",
                LOCK_DURATION_MS,
                new AbortController().signal,
                async () => {
                    throw error;
                },
            ),
        ).rejects.toBe(error);
        expect(using).toHaveBeenCalledOnce();
    });

    test("immediately propagates non-contention acquisition errors", async () => {
        const error = executionError(new Error("Redis unavailable"));
        const using = vi.fn().mockRejectedValue(error);
        const runner = new RedlockExecutionLockRunner(
            { using } as unknown as Redlock,
            { retryDelayMs: 0, retryJitterMs: 0 },
        );

        await expect(
            runner.using(
                "resource:1",
                LOCK_DURATION_MS,
                new AbortController().signal,
                async () => "unreachable",
            ),
        ).rejects.toBe(error);
        expect(using).toHaveBeenCalledOnce();
    });

    test("stops waiting for a contended lock during shutdown", async () => {
        const using = vi.fn().mockRejectedValue(contentionError());
        const runner = new RedlockExecutionLockRunner(
            { using } as unknown as Redlock,
            { retryDelayMs: 60_000, retryJitterMs: 0 },
        );
        const shutdownController = new AbortController();

        const result = runner.using(
            "resource:1",
            LOCK_DURATION_MS,
            shutdownController.signal,
            async () => "unreachable",
        );
        await vi.waitFor(() => expect(using).toHaveBeenCalledOnce());

        shutdownController.abort();

        await expect(result).rejects.toBe(shutdownController.signal.reason);
        expect(using).toHaveBeenCalledOnce();
    });

    test("passes lease loss to the routine and rejects a successful return", async () => {
        const lockController = new AbortController();
        const signal = lockSignal(lockController);
        const leaseError = new Error("Unable to extend lock");
        signal.error = leaseError;
        const using = vi.fn(async (_resources, _duration, _settings, routine) =>
            routine(signal),
        );
        const runner = new RedlockExecutionLockRunner({
            using,
        } as unknown as Redlock);
        let workloadSignal: AbortSignal | undefined;

        const result = runner.using(
            "resource:1",
            LOCK_DURATION_MS,
            new AbortController().signal,
            async (combinedSignal) => {
                workloadSignal = combinedSignal;
                await new Promise<void>((resolve) => {
                    combinedSignal.addEventListener("abort", () => resolve(), {
                        once: true,
                    });
                });
                return "must not succeed";
            },
        );
        await vi.waitFor(() => expect(workloadSignal).toBeDefined());

        lockController.abort();

        await expect(result).rejects.toBe(leaseError);
        expect(workloadSignal?.aborted).toBe(true);
        expect(workloadSignal?.reason).toBe(leaseError);
    });

    test("validates resource names and lock durations", async () => {
        const using = vi.fn();
        const runner = new RedlockExecutionLockRunner({
            using,
        } as unknown as Redlock);
        const signal = new AbortController().signal;

        await expect(
            runner.using("", LOCK_DURATION_MS, signal, async () => undefined),
        ).rejects.toThrow("resource must not be empty");
        await expect(
            runner.using("resource:1", 20_099, signal, async () => undefined),
        ).rejects.toThrow("greater than or equal to 20100ms");
        expect(using).not.toHaveBeenCalled();
    });
});
