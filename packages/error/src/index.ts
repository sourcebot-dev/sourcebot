export enum BackendError {
    CONNECTION_SYNC_SECRET_DNE = 'CONNECTION_SYNC_SECRET_DNE',
    CONNECTION_SYNC_INVALID_TOKEN = 'CONNECTION_SYNC_INVALID_TOKEN',
    CONNECTION_SYNC_SYSTEM_ERROR = 'CONNECTION_SYNC_SYSTEM_ERROR',
    CONNECTION_SYNC_CONNECTION_NOT_FOUND = 'CONNECTION_SYNC_CONNECTION_NOT_FOUND',
}

export class BackendException extends Error {
    constructor(
        public readonly code: BackendError,
        public readonly metadata: Record<string, unknown> = {}
    ) {
        super(code);
        this.name = 'BackendException';
    }
} 