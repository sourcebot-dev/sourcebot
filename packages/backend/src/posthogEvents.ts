/* eslint-disable @typescript-eslint/no-empty-object-type */

export type PosthogEventMap = {
    repo_created: {
        vcs: string;
        codeHost?: string;
    },
    repo_synced: {
        vcs: string;
        codeHost?: string;
        fetchDuration_s?: number;
        cloneDuration_s?: number;
        indexDuration_s?: number;
    },
    repo_deleted: {
        vcs: string;
        codeHost?: string;
    }
}

export type PosthogEvent = keyof PosthogEventMap;