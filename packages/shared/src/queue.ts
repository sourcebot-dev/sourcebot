
export type QueueName = keyof QueueRegistry;
export type DataOf<TName extends QueueName> = QueueRegistry[TName];
type EmptyJobData = Record<string, never>;

interface QueueRegistry {
    'connection': {
        connectionId: number,
        orgId: number
    },
    'reconciliation': EmptyJobData,
}

export const CONNECTION_QUEUE: QueueSpec<'connection'> = {
    name: 'connection',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 }
    },
    dedupKey: (data) => `connection:${data.connectionId}`,
}


export const RECONCILIATION_QUEUE: QueueSpec<'reconciliation'> = {
    name: 'reconciliation',
    jobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delayMs: 5000 },
        keep: { completed: 50, failed: 50 },
    },
};

export interface QueueSpec<TName extends QueueName> {
    name: TName;
    dedupKey?(data: DataOf<TName>): string;
    jobOptions: {
        attempts: number;
        backoff: { type: 'fixed' | 'exponential'; delayMs: number };
        keep: { completed: number; failed: number };
    };
    onEnqueued?(ctx: JobLifecycleContext<TName>): Promise<void>;
}

export interface JobLifecycleContext<TName extends QueueName> {
    data: DataOf<TName>;
    jobId: string;
    attemptsMade: number;
    maxAttempts: number;
}
