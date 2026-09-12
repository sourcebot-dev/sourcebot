import { spawn } from 'node:child_process';
import { lifecycle } from './lifecycle.js';
import type { FailureCategory } from './telemetryEvents.js';

export type DockerResult<T> =
    | { ok: true; value: T }
    | { ok: false; failureCategory: FailureCategory };
export type ComposeContainer = { Name: string; Service: string; State: string };
export class Docker {
    status: 'available' | 'unavailable' | 'error' | 'not_checked' =
        'not_checked';
    failed = false;
    constructor(
        private readonly onFailure: (category: FailureCategory) => void,
    ) {}
    private failure<T>(failureCategory: FailureCategory): DockerResult<T> {
        lifecycle.check();
        this.failed = true;
        this.onFailure(failureCategory);
        return { ok: false, failureCategory };
    }
    private async execute(args: string[]) {
        lifecycle.check();
        const result = await new Promise<{
            code: number | null;
            stdout: string;
            missing: boolean;
            stderr: string;
        }>((resolve) => {
            const child = lifecycle.child(
                spawn('docker', args, {
                    stdio: ['ignore', 'pipe', 'pipe'],
                    detached: process.platform !== 'win32',
                }),
            );
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.once('error', (error: NodeJS.ErrnoException) =>
                resolve({
                    code: null,
                    stdout: '',
                    stderr: '',
                    missing: ['ENOENT', 'EACCES'].includes(error.code ?? ''),
                }),
            );
            child.once('close', (code) =>
                resolve({ code, stdout, stderr, missing: false }),
            );
        });
        lifecycle.check();
        return result;
    }
    async run(args: string[]): Promise<DockerResult<string>> {
        const result = await this.execute(args);
        if (result.code !== 0) {
            if (result.missing) {
                this.status = 'unavailable';
            } else if (
                this.status !== 'available' &&
                this.status !== 'unavailable'
            ) {
                if (result.code === null) {
                    this.status = 'error';
                } else {
                    // Diagnose availability using fixed commands, never by parsing user stderr.
                    // These probes classify this single failed operation; they do not emit more failures.
                    const engine = await this.execute([
                        'info',
                        '--format',
                        '{{.ServerVersion}}',
                    ]);
                    const compose =
                        args[0] === 'compose' && engine.code === 0
                            ? await this.execute([
                                  'compose',
                                  'version',
                                  '--short',
                              ])
                            : undefined;
                    this.status =
                        engine.code === 0 && (!compose || compose.code === 0)
                            ? 'available'
                            : 'unavailable';
                }
            }
            // Human diagnostics stay local; never use stderr for analytics classification.
            if (
                ['stop', 'rm'].includes(args[0]) ||
                ['down', 'rm'].includes(args[1])
            ) {
                if (result.stderr.trim()) {
                    console.error(result.stderr.trim());
                }
            }
            return this.failure(
                this.status === 'unavailable'
                    ? 'docker_unavailable'
                    : 'docker_command',
            );
        }
        // A working volume command does not repair a known missing Compose plugin.
        if (this.status !== 'unavailable') {
            this.status = 'available';
        }
        return { ok: true, value: result.stdout };
    }
    async containers(): Promise<DockerResult<ComposeContainer[]>> {
        const result = await this.run([
            'compose',
            'ps',
            '-a',
            '--format',
            'json',
        ]);
        if (!result.ok) {
            return result;
        }
        try {
            const text = result.value.trim();
            const items: unknown = !text
                ? []
                : text.startsWith('[')
                  ? JSON.parse(text)
                  : text
                        .split('\n')
                        .filter(Boolean)
                        .map((line) => JSON.parse(line));
            if (
                !Array.isArray(items) ||
                items.some(
                    (c) =>
                        !c ||
                        typeof c.Name !== 'string' ||
                        typeof c.Service !== 'string' ||
                        typeof c.State !== 'string',
                )
            ) {
                throw new Error('Invalid container inventory');
            }
            return { ok: true, value: items };
        } catch {
            return this.failure('docker_command');
        }
    }
    async volumes(expected: string[]): Promise<DockerResult<string[]>> {
        if (!expected.length) {
            return { ok: true, value: [] };
        }
        const result = await this.run([
            'volume',
            'ls',
            '--format',
            '{{.Name}}',
        ]);
        if (!result.ok) {
            return result;
        }
        const names = new Set(
            result.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
        );
        return { ok: true, value: expected.filter((name) => names.has(name)) };
    }
    async portOwners(): Promise<DockerResult<Map<number, string[]>>> {
        const result = await this.run([
            'ps',
            '--format',
            '{{.Names}}\t{{.Ports}}',
        ]);
        if (!result.ok) {
            return result;
        }
        const owners = new Map<number, string[]>();
        for (const line of result.value.split('\n').filter(Boolean)) {
            const [name, ports] = line.split('\t');
            if (ports === undefined) {
                return this.failure('docker_command');
            }
            for (const match of ports.matchAll(/(\d+)->/g)) {
                const port = Number(match[1]);
                owners.set(port, [
                    ...new Set([...(owners.get(port) ?? []), name]),
                ]);
            }
        }
        return { ok: true, value: owners };
    }
}
