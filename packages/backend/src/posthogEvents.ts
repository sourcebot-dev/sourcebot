/* eslint-disable @typescript-eslint/no-empty-object-type */

export type PosthogEventMap = {
    repo_created: {
        vcs: string;
        codeHost?: string;
    },
    repo_deleted: {
        vcs: string;
        codeHost?: string;
    },
    //////////////////////////////////////////////////////////////////
    backend_connection_sync_job_failed: {
        connectionId: number,
        error: string,
    },
    backend_connection_sync_job_completed: {
        connectionId: number,
        repoCount: number,
    },
    //////////////////////////////////////////////////////////////////
}

export type PosthogEvent = keyof PosthogEventMap;