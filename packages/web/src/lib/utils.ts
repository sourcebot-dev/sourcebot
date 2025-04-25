import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import githubLogo from "@/public/github.svg";
import gitlabLogo from "@/public/gitlab.svg";
import giteaLogo from "@/public/gitea.svg";
import gerritLogo from "@/public/gerrit.svg";
import bitbucketLogo from "@/public/bitbucket.svg";
import { ServiceError } from "./serviceError";
import { Repository, RepositoryQuery } from "./types";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Adds a list of (potentially undefined) query parameters to a path.
 * 
 * @param path The path to add the query parameters to.
 * @param queryParams A list of key-value pairs (key=param name, value=param value) to add to the path.
 * @returns The path with the query parameters added.
 */
export const createPathWithQueryParams = (path: string, ...queryParams: [string, string | null][]) => {
    // Filter out undefined values
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queryParams = queryParams.filter(([_key, value]) => value !== null);

    if (queryParams.length === 0) {
        return path;
    }

    const queryString = queryParams.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? '')}`).join('&');
    return `${path}?${queryString}`;
}

export type CodeHostType = "github" | "gitlab" | "gitea" | "gerrit" | "bitbucket-cloud" | "bitbucket-server";

type CodeHostInfo = {
    type: CodeHostType;
    displayName: string;
    codeHostName: string;
    repoLink: string;
    icon: string;
    iconClassName?: string;
}

export const getRepoCodeHostInfo = (repo?: Repository): CodeHostInfo | undefined => {
    if (!repo) {
        return undefined;
    }

    if (!repo.RawConfig) {
        return undefined;
    }

    // @todo : use zod to validate config schema
    const webUrlType = repo.RawConfig['web-url-type']!;
    const displayName = repo.RawConfig['display-name'] ?? repo.RawConfig['name']!;

    return _getCodeHostInfoInternal(webUrlType, displayName, repo.URL);
}

export const getRepoQueryCodeHostInfo = (repo: RepositoryQuery): CodeHostInfo | undefined => {
    const displayName = repo.repoDisplayName ?? repo.repoName;
    return _getCodeHostInfoInternal(repo.codeHostType, displayName, repo.webUrl ?? repo.repoCloneUrl);
}

const _getCodeHostInfoInternal = (type: string, displayName: string, cloneUrl: string): CodeHostInfo | undefined => {
    switch (type) {
        case 'github': {
            const { src, className } = getCodeHostIcon('github')!;
            return {
                type: "github",
                displayName: displayName,
                codeHostName: "GitHub",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gitlab': {
            const { src, className } = getCodeHostIcon('gitlab')!;
            return {
                type: "gitlab",
                displayName: displayName,
                codeHostName: "GitLab",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gitea': {
            const { src, className } = getCodeHostIcon('gitea')!;
            return {
                type: "gitea",
                displayName: displayName,
                codeHostName: "Gitea",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gerrit':
        case 'gitiles': {
            const { src, className } = getCodeHostIcon('gerrit')!;
            return {
                type: "gerrit",
                displayName: displayName,
                codeHostName: "Gerrit",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "bitbucket-server": {
            const { src, className } = getCodeHostIcon('bitbucket-server')!;
            return {
                type: "bitbucket-server",
                displayName: displayName,
                codeHostName: "Bitbucket",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "bitbucket-cloud": {
            const { src, className } = getCodeHostIcon('bitbucket-cloud')!;
            return {
                type: "bitbucket-cloud",
                displayName: displayName,
                codeHostName: "Bitbucket",
                repoLink: cloneUrl,
                icon: src,
                iconClassName: className,
            }
        }
    }
}

export const getCodeHostIcon = (codeHostType: CodeHostType): { src: string, className?: string } | null => {
    switch (codeHostType) {
        case "github":
            return {
                src: githubLogo,
                className: "dark:invert",
            };
        case "gitlab":
            return {
                src: gitlabLogo,
            };
        case "gitea":
            return {
                src: giteaLogo,
            }
        case "gerrit":
            return {
                src: gerritLogo,
            }
        case "bitbucket-cloud":
        case "bitbucket-server":
            return {
                src: bitbucketLogo,
            }
        default:
            return null;
    }
}

export const isAuthSupportedForCodeHost = (codeHostType: CodeHostType): boolean => {
    switch (codeHostType) {
        case "github":
        case "gitlab":
        case "gitea":
        case "bitbucket-cloud":
        case "bitbucket-server":
            return true;
        case "gerrit":
            return false;
    }
}

export const isServiceError = (data: unknown): data is ServiceError => {
    return typeof data === 'object' &&
        data !== null &&
        'statusCode' in data &&
        'errorCode' in data &&
        'message' in data;
}

// From https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
export const base64Decode = (base64: string): string => {
    const binString = atob(base64);
    return Buffer.from(Uint8Array.from(binString, (m) => m.codePointAt(0)!).buffer).toString();
}

// @see: https://stackoverflow.com/a/65959350/23221295
export const isDefined = <T>(arg: T | null | undefined): arg is T extends null | undefined ? never : T => {
    return arg !== null && arg !== undefined;
}

export const getDisplayTime = (date: Date) => {
    const now = new Date();
    const minutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const hours = minutes / 60;
    const days = hours / 24;
    const months = days / 30;

    const formatTime = (value: number, unit: 'minute' | 'hour' | 'day' | 'month') => {
        const roundedValue = Math.floor(value);
        if (roundedValue < 2) {
            return `${roundedValue} ${unit} ago`;
        } else {
            return `${roundedValue} ${unit}s ago`;
        }
    }

    if (minutes < 1) {
        return 'just now';
    } else if (minutes < 60) {
        return formatTime(minutes, 'minute');
    } else if (hours < 24) {
        return formatTime(hours, 'hour');
    } else if (days < 30) {
        return formatTime(days, 'day');
    } else {
        return formatTime(months, 'month');
    }
}

export const measureSync = <T>(cb: () => T, measureName: string) => {
    const startMark = `${measureName}.start`;
    const endMark = `${measureName}.end`;

    performance.mark(startMark);
    const data = cb();
    performance.mark(endMark);

    const measure = performance.measure(measureName, startMark, endMark);
    const durationMs = measure.duration;
    console.debug(`[${measureName}] took ${durationMs}ms`);

    return {
        data,
        durationMs
    }
}

export const measure = async <T>(cb: () => Promise<T>, measureName: string) => {
    const startMark = `${measureName}.start`;
    const endMark = `${measureName}.end`;

    performance.mark(startMark);
    const data = await cb();
    performance.mark(endMark);

    const measure = performance.measure(measureName, startMark, endMark);
    const durationMs = measure.duration;
    console.debug(`[${measureName}] took ${durationMs}ms`);

    return {
        data,
        durationMs
    }
}

/**
 * Unwraps a promise that could return a ServiceError, throwing an error if it does.
 * This is useful for calling server actions in a useQuery hook since it allows us
 * to take advantage of error handling behavior built into react-query.
 * 
 * @param promise The promise to unwrap.
 * @returns The data from the promise.
 */
export const unwrapServiceError = async <T>(promise: Promise<ServiceError | T>): Promise<T> => {    
    const data = await promise;
    if (isServiceError(data)) {
        throw new Error(data.message);
    }

    return data;
}