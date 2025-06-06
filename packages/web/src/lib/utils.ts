import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import githubLogo from "@/public/github.svg";
import gitlabLogo from "@/public/gitlab.svg";
import giteaLogo from "@/public/gitea.svg";
import gerritLogo from "@/public/gerrit.svg";
import bitbucketLogo from "@/public/bitbucket.svg";
import gitLogo from "@/public/git.svg";
import googleLogo from "@/public/google.svg";
import oktaLogo from "@/public/okta.svg";
import keycloakLogo from "@/public/keycloak.svg";
import microsoftLogo from "@/public/microsoft_entra.svg";
import { ServiceError } from "./serviceError";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./errorCodes";
import { NextRequest } from "next/server";

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

export type CodeHostType =
    "github" |
    "gitlab" |
    "gitea" |
    "gerrit" |
    "bitbucket-cloud" |
    "bitbucket-server" |
    "generic-git-host";

export type AuthProviderType = 
    "github" |
    "gitlab" |
    "google" |
    "okta" |
    "keycloak" |
    "microsoft-entra-id" |
    "credentials" |
    "nodemailer";

type AuthProviderInfo = {
    id: string;
    name: string;
    displayName: string;
    icon: { src: string; className?: string } | null;
}

export const getAuthProviderInfo = (providerId: string): AuthProviderInfo => {
    switch (providerId) {
        case "github":
            return {
                id: "github",
                name: "GitHub",
                displayName: "GitHub",
                icon: {
                    src: githubLogo,
                    className: "dark:invert",
                },
            };
        case "gitlab":
            return {
                id: "gitlab", 
                name: "GitLab",
                displayName: "GitLab",
                icon: {
                    src: gitlabLogo,
                },
            };
        case "google":
            return {
                id: "google",
                name: "Google", 
                displayName: "Google",
                icon: {
                    src: googleLogo,
                },
            };
        case "okta":
            return {
                id: "okta",
                name: "Okta",
                displayName: "Okta", 
                icon: {
                    src: oktaLogo,
                    className: "dark:invert",
                },
            };
        case "keycloak":
            return {
                id: "keycloak",
                name: "Keycloak",
                displayName: "Keycloak",
                icon: {
                    src: keycloakLogo,
                },
            };
        case "microsoft-entra-id":
            return {
                id: "microsoft-entra-id",
                name: "Microsoft Entra ID",
                displayName: "Microsoft Entra ID",
                icon: {
                    src: microsoftLogo,
                },
            };
        case "credentials":
            return {
                id: "credentials",
                name: "Credentials",
                displayName: "Email & Password",
                icon: null, // No icon needed for credentials
            };
        case "nodemailer":
            return {
                id: "nodemailer",
                name: "Email",
                displayName: "Email Code",
                icon: null, // No icon needed for email
            };
        default:
            return {
                id: providerId,
                name: providerId,
                displayName: providerId.charAt(0).toUpperCase() + providerId.slice(1),
                icon: null,
            };
    }
};

type CodeHostInfo = {
    type: CodeHostType;
    displayName: string;
    codeHostName: string;
    repoLink?: string;
    icon: string;
    iconClassName?: string;
}

export const getCodeHostInfoForRepo = (repo: {
    codeHostType: string,
    name: string,
    displayName?: string,
    webUrl?: string,
}): CodeHostInfo | undefined => {
    const { codeHostType, name, displayName, webUrl } = repo;

    switch (codeHostType) {
        case 'github': {
            const { src, className } = getCodeHostIcon('github')!;
            return {
                type: "github",
                displayName: displayName ?? name,
                codeHostName: "GitHub",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gitlab': {
            const { src, className } = getCodeHostIcon('gitlab')!;
            return {
                type: "gitlab",
                displayName: displayName ?? name,
                codeHostName: "GitLab",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gitea': {
            const { src, className } = getCodeHostIcon('gitea')!;
            return {
                type: "gitea",
                displayName: displayName ?? name,
                codeHostName: "Gitea",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case 'gerrit':
        case 'gitiles': {
            const { src, className } = getCodeHostIcon('gerrit')!;
            return {
                type: "gerrit",
                displayName: displayName ?? name,
                codeHostName: "Gerrit",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "bitbucket-server": {
            const { src, className } = getCodeHostIcon('bitbucket-server')!;
            return {
                type: "bitbucket-server",
                displayName: displayName ?? name,
                codeHostName: "Bitbucket",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "bitbucket-cloud": {
            const { src, className } = getCodeHostIcon('bitbucket-cloud')!;
            return {
                type: "bitbucket-cloud",
                displayName: displayName ?? name,
                codeHostName: "Bitbucket",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "generic-git-host": {
            const { src, className } = getCodeHostIcon('generic-git-host')!;
            return {
                type: "generic-git-host",
                displayName: displayName ?? name,
                codeHostName: "Git Host",
                repoLink: webUrl,
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
        case "generic-git-host":
            return {
                src: gitLogo,
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
        case "generic-git-host":
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

export const measureSync = <T>(cb: () => T, measureName: string, outputLog: boolean = true) => {
    const startMark = `${measureName}.start`;
    const endMark = `${measureName}.end`;

    performance.mark(startMark);
    const data = cb();
    performance.mark(endMark);

    const measure = performance.measure(measureName, startMark, endMark);
    const durationMs = measure.duration;
    if (outputLog) {
        console.debug(`[${measureName}] took ${durationMs}ms`);
    }

    return {
        data,
        durationMs
    }
}

export const measure = async <T>(cb: () => Promise<T>, measureName: string, outputLog: boolean = true) => {
    const startMark = `${measureName}.start`;
    const endMark = `${measureName}.end`;

    performance.mark(startMark);
    const data = await cb();
    performance.mark(endMark);

    const measure = performance.measure(measureName, startMark, endMark);
    const durationMs = measure.duration;
    if (outputLog) {
        console.debug(`[${measureName}] took ${durationMs}ms`);
    }

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

export const requiredQueryParamGuard = (request: NextRequest, param: string): ServiceError | string => {
    const value = request.nextUrl.searchParams.get(param);
    if (!value) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.MISSING_REQUIRED_QUERY_PARAMETER,
            message: `Missing required query param: ${param}`,
        };
    }
    return value;
}

export const getRepoImageSrc = (imageUrl: string | undefined, repoId: number, domain: string): string | undefined => {
    if (!imageUrl) return undefined;
    
    try {
        const url = new URL(imageUrl);
        
        // List of known public instances that don't require authentication
        const publicHostnames = [
            'github.com',
            'gitlab.com',
            'avatars.githubusercontent.com',
            'gitea.com',
            'bitbucket.org',
        ];
        
        const isPublicInstance = publicHostnames.includes(url.hostname);
        
        if (isPublicInstance) {
            return imageUrl;
        } else {
            // Use the proxied route for self-hosted instances
            return `/api/${domain}/repos/${repoId}/image`;
        }
    } catch {
        // If URL parsing fails, use the original URL
        return imageUrl;
    }
};