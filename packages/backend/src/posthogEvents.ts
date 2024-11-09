/* eslint-disable @typescript-eslint/no-empty-object-type */

export type PosthogEventMap = {
    repo_created: {
        vcs: string;
        codeHost?: string;
    }
}

export type PosthogEvent = keyof PosthogEventMap;