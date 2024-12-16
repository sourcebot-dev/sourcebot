import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import githubLogo from "../../public/github.svg";
import gitlabLogo from "../../public/gitlab.svg";
import giteaLogo from "../../public/gitea.svg";
import gerritLogo from "../../public/gerrit.svg";
import bitbucketLogo from "../../public/bitbucket.svg";
import { ServiceError } from "./serviceError";
import { Repository } from "./types";

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

type CodeHostInfo = {
    type: "github" | "gitlab" | "gitea" | "gerrit" | "bitbucket";
    displayName: string;
    costHostName: string;
    repoLink: string;
    icon: string;
    iconClassName?: string;
}

export const getRepoCodeHostInfo = (repo?: Repository): CodeHostInfo | undefined => {
    if (!repo) {
        return undefined;
    }

    const webUrlType = repo.RawConfig ? repo.RawConfig['web-url-type'] : undefined;
    if (!webUrlType) {
        return undefined;
    }

    const url = new URL(repo.URL);
    const displayName = url.pathname.slice(1);
    switch (webUrlType) {
        case 'github':
            return {
                type: "github",
                displayName: displayName,
                costHostName: "GitHub",
                repoLink: repo.URL,
                icon: githubLogo,
                iconClassName: "dark:invert",
            }
        case 'gitlab':
            return {
                type: "gitlab",
                displayName: displayName,
                costHostName: "GitLab",
                repoLink: repo.URL,
                icon: gitlabLogo,
            }
        case 'gitea':
            return {
                type: "gitea",
                displayName: displayName,
                costHostName: "Gitea",
                repoLink: repo.URL,
                icon: giteaLogo,
            }
        case 'gitiles':
            return {
                type: "gerrit",
                displayName: displayName,
                costHostName: "Gerrit",
                repoLink: repo.URL,
                icon: gerritLogo,
            }
        case 'bitbucket':
            return {
                type: "bitbucket",
                displayName: displayName,
                costHostName: "Bitbucket",
                repoLink: repo.URL,
                icon: bitbucketLogo,
            }
    }
}

export const isServiceError = (data: unknown): data is ServiceError => {
    return typeof data === 'object' &&
        data !== null &&
        'statusCode' in data &&
        'errorCode' in data &&
        'message' in data;
}

export const getEnv = (env: string | undefined, defaultValue?: string) => {
	return env ?? defaultValue;
}

export const getEnvNumber = (env: string | undefined, defaultValue: number = 0) => {
	return Number(env) ?? defaultValue;
}

export const getEnvBoolean = (env: string | undefined, defaultValue: boolean) => {
	if (!env) {
		return defaultValue;
	}
	return env === 'true' || env === '1';
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
