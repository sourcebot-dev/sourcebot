/* eslint-disable @typescript-eslint/no-empty-object-type */

export type PosthogEventMap = {
    backend_connection_sync_job_failed: {
        connectionId: number,
        type: string,
    },
    backend_connection_sync_job_completed: {
        connectionId: number,
        repoCount: number,
        type: string,
    },
    backend_revisions_truncated: {
        repoId: number,
        revisionCount: number,
    },
    backend_repo_index_job_failed: {
        repoId: number,
        jobType: 'INDEX' | 'CLEANUP',
        type: string,
    },
    backend_repo_index_job_completed: {
        repoId: number,
        jobType: 'INDEX' | 'CLEANUP',
        type: string,
    },
}

export type PosthogEvent = keyof PosthogEventMap;