// Type declarations for redlock
// The redlock package's exports field doesn't include types, so TypeScript can't resolve them.
// This file re-exports the types from the actual .d.ts file.

declare module 'redlock' {
    import { EventEmitter } from "events";
    import { Redis as IORedisClient, Cluster as IORedisCluster } from "ioredis";

    type Client = IORedisClient | IORedisCluster;

    export type ClientExecutionResult = {
        client: Client;
        vote: "for";
        value: number;
    } | {
        client: Client;
        vote: "against";
        error: Error;
    };

    export type ExecutionStats = {
        readonly membershipSize: number;
        readonly quorumSize: number;
        readonly votesFor: Set<Client>;
        readonly votesAgainst: Map<Client, Error>;
    };

    export type ExecutionResult = {
        attempts: ReadonlyArray<Promise<ExecutionStats>>;
    };

    export interface Settings {
        readonly driftFactor: number;
        readonly retryCount: number;
        readonly retryDelay: number;
        readonly retryJitter: number;
        readonly automaticExtensionThreshold: number;
    }

    export class ResourceLockedError extends Error {
        readonly message: string;
        constructor(message: string);
    }

    export class ExecutionError extends Error {
        readonly message: string;
        readonly attempts: ReadonlyArray<Promise<ExecutionStats>>;
        constructor(message: string, attempts: ReadonlyArray<Promise<ExecutionStats>>);
    }

    export class Lock {
        readonly redlock: Redlock;
        readonly resources: string[];
        readonly value: string;
        readonly attempts: ReadonlyArray<Promise<ExecutionStats>>;
        expiration: number;
        constructor(redlock: Redlock, resources: string[], value: string, attempts: ReadonlyArray<Promise<ExecutionStats>>, expiration: number);
        release(): Promise<ExecutionResult>;
        extend(duration: number): Promise<Lock>;
    }

    export type RedlockAbortSignal = AbortSignal & {
        error?: Error;
    };

    export default class Redlock extends EventEmitter {
        readonly clients: Set<Client>;
        readonly settings: Settings;
        readonly scripts: {
            readonly acquireScript: {
                value: string;
                hash: string;
            };
            readonly extendScript: {
                value: string;
                hash: string;
            };
            readonly releaseScript: {
                value: string;
                hash: string;
            };
        };
        constructor(clients: Iterable<Client>, settings?: Partial<Settings>, scripts?: {
            readonly acquireScript?: string | ((script: string) => string);
            readonly extendScript?: string | ((script: string) => string);
            readonly releaseScript?: string | ((script: string) => string);
        });
        quit(): Promise<void>;
        acquire(resources: string[], duration: number, settings?: Partial<Settings>): Promise<Lock>;
        release(lock: Lock, settings?: Partial<Settings>): Promise<ExecutionResult>;
        extend(existing: Lock, duration: number, settings?: Partial<Settings>): Promise<Lock>;
        using<T>(resources: string[], duration: number, settings: Partial<Settings>, routine?: (signal: RedlockAbortSignal) => Promise<T>): Promise<T>;
        using<T>(resources: string[], duration: number, routine: (signal: RedlockAbortSignal) => Promise<T>): Promise<T>;
    }
}
