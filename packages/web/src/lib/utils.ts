import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import githubLogo from "@/public/github.svg";
import azuredevopsLogo from "@/public/azuredevops.svg";
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
import { ConnectionType, Org } from "@sourcebot/db";
import { OrgMetadata, orgMetadataSchema } from "@/types";
import { SINGLE_TENANT_ORG_DOMAIN } from "./constants";
import { CodeHostType } from "@sourcebot/db";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Gets the base URL from Next.js headers
 * @param headersList The headers from Next.js headers() function
 * @returns The base URL (e.g., "https://example.com")
 */
export const getBaseUrl = (headersList: Headers): string => {
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    return `${protocol}://${host}`;
}

/**
 * Creates an invite link URL from the base URL and invite ID
 * @param baseUrl The base URL of the application
 * @param inviteLinkId The invite link ID
 * @returns The complete invite link URL or null if no inviteLinkId
 */
export const createInviteLink = (baseUrl: string, inviteLinkId?: string | null): string | null => {
    return inviteLinkId ? `${baseUrl}/invite?id=${inviteLinkId}` : null;
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
    codeHostType: CodeHostType,
    name: string,
    displayName?: string,
    webUrl?: string,
}): CodeHostInfo => {
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
        case 'azuredevops': {
            const { src, className } = getCodeHostIcon('azuredevops')!;
            return {
                type: "azuredevops",
                displayName: displayName ?? name,
                codeHostName: "Azure DevOps",
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
        case 'gerrit': {
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
        case "bitbucketServer": {
            const { src, className } = getCodeHostIcon('bitbucketServer')!;
            return {
                type: "bitbucketServer",
                displayName: displayName ?? name,
                codeHostName: "Bitbucket",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "bitbucketCloud": {
            const { src, className } = getCodeHostIcon('bitbucketCloud')!;
            return {
                type: "bitbucketCloud",
                displayName: displayName ?? name,
                codeHostName: "Bitbucket",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
        case "genericGitHost": {
            const { src, className } = getCodeHostIcon('genericGitHost')!;
            return {
                type: "genericGitHost",
                displayName: displayName ?? name,
                codeHostName: "Git Host",
                repoLink: webUrl,
                icon: src,
                iconClassName: className,
            }
        }
    }
}

export const getCodeHostIcon = (codeHostType: CodeHostType | ConnectionType): { src: string, className?: string } => {
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
        case "bitbucket":
        case "bitbucketCloud":
        case "bitbucketServer":
            return {
                src: bitbucketLogo,
            }
        case "azuredevops":
            return {
                src: azuredevopsLogo,
            }
        case "git":
        case "genericGitHost":
            return {
                src: gitLogo,
            }
    }
}

export const getCodeHostCommitUrl = ({
    webUrl,
    codeHostType,
    commitHash,
}: {
    webUrl?: string | null,
    codeHostType: CodeHostType,
    commitHash: string,
}) => {
    if (!webUrl) {
        return undefined;
    }

    switch (codeHostType) {
        case 'github':
            return `${webUrl}/commit/${commitHash}`;
        case 'gitlab':
            return `${webUrl}/-/commit/${commitHash}`;
        case 'gitea':
            return `${webUrl}/commit/${commitHash}`;
        case 'azuredevops':
            return `${webUrl}/commit/${commitHash}`;
        case 'bitbucketCloud':
            return `${webUrl}/commits/${commitHash}`;
        case 'bitbucketServer':
            return `${webUrl}/commits/${commitHash}`;
        case 'gerrit':
            return `${webUrl}/+/${commitHash}`;
        case 'genericGitHost':
            return undefined;
    }
}

export const getCodeHostBrowseAtBranchUrl = ({
    webUrl,
    codeHostType,
    branchName,
}: {
    webUrl?: string | null,
    codeHostType: CodeHostType,
    branchName: string,
}) => {
    if (!webUrl) {
        return undefined;
    }

    switch (codeHostType) {
        case 'github':
            return `${webUrl}/tree/${branchName}`;
        case 'gitlab':
            return `${webUrl}/-/tree/${branchName}`;
        case 'gitea':
            return `${webUrl}/src/branch/${branchName}`;
        case 'azuredevops':
            return `${webUrl}?branch=${branchName}`;
        case 'bitbucketCloud':
            return `${webUrl}?at=${branchName}`;
        case 'bitbucketServer':
            return `${webUrl}?at=${branchName}`;
        case 'gerrit':
            return `${webUrl}/+/${branchName}`;
        case 'genericGitHost':
            return undefined;
    }
}

export const getCodeHostBrowseFileAtBranchUrl = ({
    webUrl,
    codeHostType,
    branchName,
    filePath,
}: {
    webUrl?: string | null,
    codeHostType: CodeHostType,
    branchName: string,
    filePath: string,
}) => {
    if (!webUrl) {
        return undefined;
    }

    switch (codeHostType) {
        case 'github':
            return `${webUrl}/blob/${branchName}/${filePath}`;
        case 'gitlab':
            return `${webUrl}/-/blob/${branchName}/${filePath}`;
        case 'gitea':
            return `${webUrl}/src/branch/${branchName}/${filePath}`;
        case 'azuredevops':
            return `${webUrl}?path=${filePath}&version=${branchName}`;
        case 'bitbucketCloud':
            return `${webUrl}/src/${branchName}/${filePath}`;
        case 'bitbucketServer':
            return `${webUrl}/browse/${filePath}?at=${branchName}`;
        case 'gerrit':
            return `${webUrl}/+/${branchName}/${filePath}`;
        case 'genericGitHost':
            return undefined;

    }
}

export const isAuthSupportedForCodeHost = (codeHostType: CodeHostType): boolean => {
    switch (codeHostType) {
        case "github":
        case "gitlab":
        case "gitea":
        case "bitbucketCloud":
        case "bitbucketServer":
        case "azuredevops":
            return true;
        case "genericGitHost":
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

// @see: https://stackoverflow.com/a/65959350/23221295
export const isDefined = <T>(arg: T | null | undefined): arg is T extends null | undefined ? never : T => {
    return arg !== null && arg !== undefined;
}

export const getFormattedDate = (date: Date) => {
    const now = new Date();
    const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const isFuture = diffMinutes < 0;

    // Use absolute values for calculations
    const minutes = Math.abs(diffMinutes);
    const hours = minutes / 60;
    const days = hours / 24;
    const months = days / 30;

    const formatTime = (value: number, unit: 'minute' | 'hour' | 'day' | 'month', isFuture: boolean) => {
        const roundedValue = Math.floor(value);
        const pluralUnit = roundedValue === 1 ? unit : `${unit}s`;

        if (isFuture) {
            return `In ${roundedValue} ${pluralUnit}`;
        } else {
            return `${roundedValue} ${pluralUnit} ago`;
        }
    }

    if (minutes < 1) {
        return 'just now';
    } else if (minutes < 60) {
        return formatTime(minutes, 'minute', isFuture);
    } else if (hours < 24) {
        return formatTime(hours, 'hour', isFuture);
    } else if (days < 30) {
        return formatTime(days, 'day', isFuture);
    } else {
        return formatTime(months, 'month', isFuture);
    }
}

/**
 * Converts a number to a string
 */
export const getShortenedNumberDisplayString = (number: number) => {
    if (number < 1000) {
        return number.toString();
    } else if (number < 1000000) {
        return `${(number / 1000).toFixed(1)}k`;
    } else {
        return `${(number / 1000000).toFixed(1)}m`;
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

export const getRepoImageSrc = (imageUrl: string | undefined, repoId: number): string | undefined => {
    if (!imageUrl) return undefined;

    try {
        const url = new URL(imageUrl);

        // List of known public instances that don't require authentication
        const publicHostnames = [
            'github.com',
            'avatars.githubusercontent.com',
            'gitea.com',
            'bitbucket.org',
        ];

        const isPublicInstance = publicHostnames.includes(url.hostname);

        if (isPublicInstance) {
            return imageUrl;
        } else {
            // Use the proxied route for self-hosted instances
            return `/api/${SINGLE_TENANT_ORG_DOMAIN}/repos/${repoId}/image`;
        }
    } catch {
        // If URL parsing fails, use the original URL
        return imageUrl;
    }
};

export const getOrgMetadata = (org: Org): OrgMetadata | null => {
    const currentMetadata = orgMetadataSchema.safeParse(org.metadata);
    return currentMetadata.success ? currentMetadata.data : null;
}

export const IS_MAC = typeof navigator !== 'undefined' && /Mac OS X/.test(navigator.userAgent);


export const isHttpError = (error: unknown, status: number): boolean => {
    return error !== null
        && typeof error === 'object'
        && 'status' in error
        && error.status === status;
}