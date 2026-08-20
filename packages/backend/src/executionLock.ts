/// <reference path="./types/redlock.d.ts" />

import { createLogger } from "@sourcebot/shared";
import type { Redis } from "ioredis";
import Redlock, {
    ExecutionError,
    ResourceLockedError,
    type RedlockAbortSignal,
} from "redlock";

const LOG_TAG = "execution-lock";
const logger = createLogger(LOG_TAG);

const REDLOCK_RETRY_DELAY_MS = 250;
const REDLOCK_RETRY_JITTER_MS = 100;
const REDLOCK_AUTOMATIC_EXTENSION_THRESHOLD_MS = 20_000;

const REDLOCK_SETTINGS = {
    driftFactor: 0.01,
    retryCount: 0,
    retryDelay: REDLOCK_RETRY_DELAY_MS,
    retryJitter: REDLOCK_RETRY_JITTER_MS,
    automaticExtensionThreshold: REDLOCK_AUTOMATIC_EXTENSION_THRESHOLD_MS,
} as const;

type RedlockUsingClient = Pick<Redlock, "using">;

export interface ExecutionLockRunner {
    using<TResult>(
        resource: string,
        durationMs: number,
        shutdownSignal: AbortSignal,
        routine: (signal: AbortSignal) => Promise<TResult>,
    ): Promise<TResult>;
}

interface RedlockExecutionLockRunnerOptions {
    retryDelayMs?: number;
    retryJitterMs?: number;
    random?: () => number;
}

const abortReason = (signal: AbortSignal): Error => {
    if (signal.reason instanceof Error) {
        return signal.reason;
    }

    return new Error(
        signal.reason === undefined
            ? "The operation was aborted"
            : String(signal.reason),
    );
};

const abortableDelay = async (
    durationMs: number,
    signal: AbortSignal,
): Promise<void> => {
    if (signal.aborted) {
        throw abortReason(signal);
    }

    await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timeout);
            reject(abortReason(signal));
        };
        const timeout = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, durationMs);

        signal.addEventListener("abort", onAbort, { once: true });
    });
};

const combineAbortSignals = (
    shutdownSignal: AbortSignal,
    lockSignal: RedlockAbortSignal,
): { signal: AbortSignal; dispose: () => void } => {
    const controller = new AbortController();
    const abortFromShutdown = () => {
        controller.abort(abortReason(shutdownSignal));
    };
    const abortFromLock = () => {
        controller.abort(lockSignal.error ?? abortReason(lockSignal));
    };

    shutdownSignal.addEventListener("abort", abortFromShutdown, {
        once: true,
    });
    lockSignal.addEventListener("abort", abortFromLock, { once: true });

    if (lockSignal.aborted) {
        abortFromLock();
    } else if (shutdownSignal.aborted) {
        abortFromShutdown();
    }

    return {
        signal: controller.signal,
        dispose: () => {
            shutdownSignal.removeEventListener("abort", abortFromShutdown);
            lockSignal.removeEventListener("abort", abortFromLock);
        },
    };
};

const isLockContention = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof ExecutionError) || error.attempts.length === 0) {
        return false;
    }

    const attempts = await Promise.all(error.attempts);
    return attempts.every(
        ({ votesAgainst }) =>
            votesAgainst.size > 0 &&
            [...votesAgainst.values()].every(
                (attemptError) => attemptError instanceof ResourceLockedError,
            ),
    );
};

export class RedlockExecutionLockRunner implements ExecutionLockRunner {
    private readonly retryDelayMs: number;
    private readonly retryJitterMs: number;
    private readonly random: () => number;

    constructor(
        private readonly redlock: RedlockUsingClient,
        options: RedlockExecutionLockRunnerOptions = {},
    ) {
        this.retryDelayMs = options.retryDelayMs ?? REDLOCK_RETRY_DELAY_MS;
        this.retryJitterMs = options.retryJitterMs ?? REDLOCK_RETRY_JITTER_MS;
        this.random = options.random ?? Math.random;
    }

    async using<TResult>(
        resource: string,
        durationMs: number,
        shutdownSignal: AbortSignal,
        routine: (signal: AbortSignal) => Promise<TResult>,
    ): Promise<TResult> {
        if (resource.length === 0) {
            throw new Error("Execution lock resource must not be empty");
        }
        if (
            !Number.isInteger(durationMs) ||
            durationMs < REDLOCK_AUTOMATIC_EXTENSION_THRESHOLD_MS + 100
        ) {
            throw new Error(
                `Execution lock duration must be an integer greater than or equal to ${REDLOCK_AUTOMATIC_EXTENSION_THRESHOLD_MS + 100}ms`,
            );
        }

        while (true) {
            if (shutdownSignal.aborted) {
                throw abortReason(shutdownSignal);
            }

            let acquired = false;
            try {
                return await this.redlock.using(
                    [resource],
                    durationMs,
                    { retryCount: 0 },
                    async (lockSignal) => {
                        acquired = true;
                        const combined = combineAbortSignals(
                            shutdownSignal,
                            lockSignal,
                        );

                        try {
                            if (combined.signal.aborted) {
                                throw abortReason(combined.signal);
                            }

                            const result = await routine(combined.signal);

                            if (combined.signal.aborted) {
                                throw abortReason(combined.signal);
                            }

                            return result;
                        } finally {
                            combined.dispose();
                        }
                    },
                );
            } catch (error) {
                if (acquired || !(await isLockContention(error))) {
                    throw error;
                }

                const delayMs = Math.max(
                    0,
                    this.retryDelayMs +
                        Math.floor(
                            (this.random() * 2 - 1) * this.retryJitterMs,
                        ),
                );
                await abortableDelay(delayMs, shutdownSignal);
            }
        }
    }
}

export const createExecutionLockRunner = (
    redis: Redis,
): ExecutionLockRunner => {
    const redlock = new Redlock([redis], REDLOCK_SETTINGS);
    redlock.on("error", (error: unknown) => {
        if (error instanceof ResourceLockedError) {
            return;
        }

        logger.error("Unexpected Redlock error", error);
    });

    return new RedlockExecutionLockRunner(redlock);
};
