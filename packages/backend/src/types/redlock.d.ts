// redlock@5.0.0-beta.2 bundles this declaration, but its package exports do not
// expose it to TypeScript's Node16 module resolution. Keep this narrow surface in
// sync with the upstream declaration until the package publishes a fixed export.
declare module "redlock" {
    import { EventEmitter } from "events";
    import { Cluster, Redis } from "ioredis";

    type Client = Redis | Cluster;

    export interface ExecutionStats {
        readonly membershipSize: number;
        readonly quorumSize: number;
        readonly votesFor: Set<Client>;
        readonly votesAgainst: Map<Client, Error>;
    }

    export interface Settings {
        readonly driftFactor: number;
        readonly retryCount: number;
        readonly retryDelay: number;
        readonly retryJitter: number;
        readonly automaticExtensionThreshold: number;
    }

    export class ResourceLockedError extends Error {
        constructor(message: string);
    }

    export class ExecutionError extends Error {
        readonly attempts: ReadonlyArray<Promise<ExecutionStats>>;
        constructor(
            message: string,
            attempts: ReadonlyArray<Promise<ExecutionStats>>,
        );
    }

    export type RedlockAbortSignal = AbortSignal & {
        error?: Error;
    };

    export default class Redlock extends EventEmitter {
        constructor(clients: Iterable<Client>, settings?: Partial<Settings>);

        using<TResult>(
            resources: string[],
            duration: number,
            settings: Partial<Settings>,
            routine: (signal: RedlockAbortSignal) => Promise<TResult>,
        ): Promise<TResult>;

        using<TResult>(
            resources: string[],
            duration: number,
            routine: (signal: RedlockAbortSignal) => Promise<TResult>,
        ): Promise<TResult>;
    }
}
