import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import githubLogo from "../../public/github.svg";
import gitlabLogo from "../../public/gitlab.svg";

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
    type: "github" | "gitlab";
    repoName: string;
    costHostName: string;
    repoLink: string;
    icon: string;
}

export const getRepoCodeHostInfo = (repoName: string): CodeHostInfo | undefined => {
    if (repoName.startsWith("github.com")) {
        return {
            type: "github",
            repoName: repoName.substring("github.com/".length),
            costHostName: "GitHub",
            repoLink: `https://${repoName}`,
            icon: githubLogo,
        }
    }
    
    if (repoName.startsWith("gitlab.com")) {
        return {
            type: "gitlab",
            repoName: repoName.substring("gitlab.com/".length),
            costHostName: "GitLab",
            repoLink: `https://${repoName}`,
            icon: gitlabLogo,
        }
    }

    return undefined;
}

export const getCodeHostFilePreviewLink = (repoName: string, filePath: string): string | undefined => {
    const info = getRepoCodeHostInfo(repoName);

    if (info?.type === "github") {
        return `${info.repoLink}/blob/HEAD/${filePath}`;
    }

    if (info?.type === "gitlab") {
        return `${info.repoLink}/-/blob/HEAD/${filePath}`;
    }

    return undefined;
}