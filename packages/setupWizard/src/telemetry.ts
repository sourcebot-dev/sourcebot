import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PostHog } from 'posthog-node';
import {
    eventSchemas,
    validateFields,
    type Events,
    type EventName,
} from './telemetryEvents.js';

export const INSTALL_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Same public ingestion token as packages/shared/src/env.server.ts. Never read user overrides.
export const POSTHOG_PROJECT_TOKEN =
    'phc_lLPuFFi5LH6c94eFJcqvYVFwiJffVcV6HD8U4a1OnRW';
export const POSTHOG_OPTIONS = {
    host: 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    disableGeoip: true,
    isServer: false,
} as const;
function bestEffort<T>(read: () => T, fallback: T): T {
    try {
        return read();
    } catch {
        return fallback;
    }
}
export function systemProperties(runtime = process) {
    return {
        platform: bestEffort(
            () =>
                ['darwin', 'linux', 'win32'].includes(runtime.platform)
                    ? runtime.platform
                    : 'other',
            'other',
        ),
        arch: bestEffort(
            () =>
                ['arm64', 'x64'].includes(runtime.arch)
                    ? runtime.arch
                    : 'other',
            'other',
        ),
        nodeMajorVersion: bestEffort<number | null>(() => {
            const v = Number(runtime.versions.node.split('.')[0]);
            return Number.isSafeInteger(v) && v > 0 ? v : null;
        }, null),
        packageManager: bestEffort(
            () =>
                /^(npm|yarn|pnpm|bun)\//.exec(
                    runtime.env.npm_config_user_agent ?? '',
                )?.[1] ?? 'unknown',
            'unknown',
        ),
        isCI: bestEffort<boolean | null>(
            () =>
                ['CI', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'RUN_ID'].some(
                    (k) => !!runtime.env[k] && runtime.env[k] !== 'false',
                ),
            null,
        ),
    };
}
export function invocationMethod(): Events['started']['invocationMethod'] {
    return bestEffort(() => {
        if (
            process.env.npm_command === 'exec' ||
            process.argv[1]?.includes('_npx')
        ) {
            return 'npx';
        }
        if (process.env.npm_lifecycle_event) {
            return 'workspace';
        }
        return process.argv[1]?.includes('node_modules')
            ? 'local_binary'
            : 'unknown';
    }, 'unknown');
}
type Client = Pick<PostHog, 'capture' | 'shutdown' | 'on'>;
export class Telemetry {
    readonly setupSessionId: string | undefined;
    private client?: Client;
    private readonly began: number;
    private shutdownPromise?: Promise<void>;
    private closed = false;
    private readonly wallClockStart = Date.now();
    private lastTimestamp = 0;
    constructor(
        createClient: () => Client = () =>
            new PostHog(POSTHOG_PROJECT_TOKEN, POSTHOG_OPTIONS),
        uuid: () => string = randomUUID,
        private readonly clock = () => performance.now(),
    ) {
        this.began = clock();
        this.setupSessionId = bestEffort(() => {
            const id = uuid();
            return INSTALL_ID_PATTERN.test(id) ? id : undefined;
        }, undefined);
        if (this.setupSessionId) {
            this.client = bestEffort(() => createClient(), undefined);
            bestEffort(() => this.client?.on('error', () => {}), undefined);
        }
    }
    elapsed(): number {
        return Math.max(0, Math.round(this.clock() - this.began));
    }
    capture<K extends EventName>(event: K, values: Events[K]): void {
        if (this.closed || !this.client || !this.setupSessionId) {
            return;
        }
        try {
            const properties = validateFields(
                eventSchemas[event],
                values as never,
            );
            const version: unknown = bestEffort(
                () =>
                    JSON.parse(
                        readFileSync(
                            new URL('../package.json', import.meta.url),
                            'utf8',
                        ),
                    ).version,
                'unknown',
            );
            // Immediate independent requests can be ingested out of order. Preserve
            // session order even across wall-clock adjustments and same-ms checkpoints.
            this.lastTimestamp = Math.max(
                this.lastTimestamp + 1,
                this.wallClockStart + this.elapsed(),
            );
            this.client.capture({
                distinctId: this.setupSessionId,
                event: `setup_sourcebot_${event}`,
                groups: { company: this.setupSessionId },
                timestamp: new Date(this.lastTimestamp),
                properties: {
                    ...properties,
                    ...systemProperties(),
                    schemaVersion: 1,
                    source: 'setup-sourcebot-cli',
                    setupSourcebotVersion:
                        typeof version === 'string' &&
                        /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)
                            ? version
                            : 'unknown',
                    setupSessionId: this.setupSessionId,
                    install_id: this.setupSessionId,
                    elapsedMs: this.elapsed(),
                    $geoip_disable: true,
                    $ignore_sent_at: true,
                },
            });
        } catch {
            /* Telemetry never participates in setup success. */
        }
    }
    shutdown(): Promise<void> {
        if (!this.shutdownPromise) {
            this.closed = true;
            this.shutdownPromise = (async () => {
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    await Promise.race([
                        this.client?.shutdown(1000),
                        new Promise<void>((resolve) => {
                            timer = setTimeout(resolve, 1000);
                        }),
                    ]);
                } catch {
                    /* Best effort. */
                } finally {
                    clearTimeout(timer);
                }
            })();
        }
        return this.shutdownPromise;
    }
}
