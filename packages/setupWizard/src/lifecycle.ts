import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { join } from 'node:path';
import { Telemetry } from './telemetry.js';
import type {
    Events,
    EventName,
    Stage,
    FailureCategory,
} from './telemetryEvents.js';

export class Lifecycle {
    readonly controller = new AbortController();
    readonly children = new Set<ChildProcess>();
    private readonly cleanups = new Set<() => void>();
    stage: Stage = 'setup_directory';
    failureCategory: FailureCategory = 'unknown';
    terminal?: 'completed' | 'cancelled' | 'failed';
    interrupted = false;
    private installed = false;
    private startFailureCaptured = false;
    constructor(readonly telemetry = new Telemetry()) {}
    get signal(): AbortSignal {
        return this.controller.signal;
    }
    check(): void {
        this.signal.throwIfAborted();
    }
    install(): void {
        if (!this.installed) {
            this.installed = true;
            process.on('SIGINT', this.interrupt);
        }
    }
    dispose(): void {
        process.off('SIGINT', this.interrupt);
        this.installed = false;
    }
    exit(code: number): never {
        this.dispose();
        this.controller.abort();
        for (const cleanup of this.cleanups) {
            try {
                cleanup();
            } catch {
                /* Cleanup is independent of telemetry. */
            }
        }
        this.killChildren(true);
        // SDK retry sockets/timers can outlive its bounded shutdown promise.
        // Only call after main returns, never at the foreground Docker handoff.
        process.exit(code);
    }
    own(cleanup: () => void): () => void {
        this.cleanups.add(cleanup);
        return () => this.cleanups.delete(cleanup);
    }
    child(child: ChildProcess): ChildProcess {
        this.children.add(child);
        child.once('close', () => {
            // A client can exit before descendants that ignored its interrupt.
            // Tear down its dedicated group before relinquishing ownership.
            if (process.platform !== 'win32' && child.pid) {
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch { /* The group normally no longer exists. */ }
            }
            this.children.delete(child);
        });
        if (this.interrupted) {
            child.kill();
        }
        return child;
    }
    capture<K extends EventName>(name: K, props: Events[K]): void {
        if (!this.terminal && !this.interrupted) {
            this.telemetry.capture(name, props);
        }
    }
    fail(category: FailureCategory, recoverable: boolean): void {
        if (this.interrupted || this.terminal) {
            return;
        }
        if (!recoverable) {
            this.terminal = 'failed';
        }
        this.telemetry.capture('failed', {
            stage: this.stage,
            failureCategory: category,
            recoverable,
        });
    }
    startFailed(properties: Events['start_failed']): void {
        if (this.interrupted || this.startFailureCaptured || (this.terminal && this.terminal !== 'completed')) {
            return;
        }
        this.startFailureCaptured = true;
        this.telemetry.capture('start_failed', properties);
    }
    async complete(properties: Events['completed'], keepTelemetryOpen = false): Promise<void> {
        if (this.terminal || this.interrupted) {
            return;
        }
        this.terminal = 'completed';
        this.telemetry.capture('completed', properties);
        if (!keepTelemetryOpen) {
            await this.telemetry.shutdown();
        }
    }
    async decline(reason: Events['cancelled']['reason']): Promise<void> {
        if (!this.terminal) {
            this.terminal = 'cancelled';
            this.telemetry.capture('cancelled', { stage: this.stage, reason });
        }
        await this.telemetry.shutdown();
    }
    private killChildren(force: boolean): void {
        for (const child of this.children) {
            if (
                child.exitCode !== null ||
                child.signalCode !== null ||
                !child.pid
            ) {
                continue;
            }
            try {
                if (process.platform === 'win32') {
                    const taskkill = join(
                        process.env.SystemRoot ?? 'C:\\Windows',
                        'System32',
                        'taskkill.exe',
                    );
                    const killer = spawn(
                        taskkill,
                        [
                            '/pid',
                            String(child.pid),
                            '/T',
                            ...(force ? ['/F'] : []),
                        ],
                        { stdio: 'ignore' },
                    );
                    killer.on('error', () => {});
                    killer.unref();
                } else {
                    // Owned Docker clients run in their own POSIX group, never the user's shell group.
                    process.kill(-child.pid, force ? 'SIGKILL' : 'SIGINT');
                }
            } catch {
                /* Child may have exited concurrently. */
            }
        }
    }
    interrupt = (): void => {
        if (this.interrupted) {
            this.killChildren(true);
            process.exit(130);
        }
        this.interrupted = true;
        if (!this.terminal) {
            this.terminal = 'cancelled';
            this.telemetry.capture('cancelled', {
                stage: this.stage,
                reason: 'keyboard_interrupt',
            });
        }
        this.controller.abort();
        for (const cleanup of this.cleanups) {
            try {
                cleanup();
            } catch {
                /* Independent cleanup must proceed. */
            }
        }
        this.killChildren(false);
        const force = setTimeout(() => this.killChildren(true), 2000);
        const deadline = setTimeout(() => {
            this.killChildren(true);
            process.exit(130);
        }, 3000);
        void (async () => {
            await this.telemetry.shutdown();
            while (
                [...this.children].some(
                    (c) => c.exitCode === null && c.signalCode === null,
                )
            ) {
                await sleep(20);
            }
            clearTimeout(force);
            clearTimeout(deadline);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
            process.stdout.write('\u001b[?25h\n');
            process.exit(130);
        })().catch(() => {
            /* Deadline still forces exit. */
        });
    };
}
export const lifecycle = new Lifecycle();
export async function wizardFetch(
    input: string | URL,
    init: RequestInit = {},
): Promise<Response> {
    lifecycle.check();
    const signal = init.signal
        ? AbortSignal.any([lifecycle.signal, init.signal])
        : lifecycle.signal;
    try {
        const result = await fetch(input, { ...init, signal });
        lifecycle.check();
        return result;
    } catch (error) {
        lifecycle.check();
        lifecycle.failureCategory = 'network';
        throw error;
    }
}
