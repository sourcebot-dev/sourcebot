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
    }
}

export type PosthogEvent = keyof PosthogEventMap;