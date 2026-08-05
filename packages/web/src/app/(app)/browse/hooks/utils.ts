import { BrowseState, SET_BROWSE_STATE_QUERY_PARAM } from "../browseStateProvider";

export const HIGHLIGHT_RANGE_QUERY_PARAM = 'highlightRange';
export const PREVIEW_REF_QUERY_PARAM = 'ref';
export const DIFF_QUERY_PARAM = 'diff';
export const BLAME_QUERY_PARAM = 'blame';

export type BrowseHighlightRange = {
    start: { lineNumber: number; column: number; };
    end: { lineNumber: number; column: number; };
} | {
    start: { lineNumber: number; };
    end: { lineNumber: number; };
}

type BaseProps = {
    repoName: string;
    path: string;
    revisionName?: string;
    setBrowseState?: Partial<BrowseState>;
}

type BlobProps = BaseProps & {
    pathType: 'blob',
    highlightRange?: BrowseHighlightRange;
    // Override the ref the file's content is fetched at, while the surrounding
    // browse context (file tree, etc.) stays anchored to `revisionName`.
    previewRef?: string;
    // When true, render the focused commit diff (for `previewRef`) instead of
    // the file's source. Only meaningful alongside `previewRef`.
    diff?: boolean;
    // When true, render blame annotations alongside the file source.
    blame?: boolean;
}

type TreeProps = BaseProps & {
    pathType: 'tree',
}

type CommitsProps = BaseProps & {
    pathType: 'commits',
}

type CommitProps = BaseProps & {
    pathType: 'commit',
    commitSha: string,
}

export type BrowseProps =
    BlobProps |
    TreeProps |
    CommitsProps |
    CommitProps;

export type BrowsePathType = BrowseProps['pathType'];

// Repo-relative paths shouldn't have leading slashes — `git log -- /foo` (or
// just `--`) treats them as absolute filesystem paths. Repo root and `/`
// both map to the empty path.
const normalizeRepoPath = (path: string): string => path.replace(/^\/+/, '');

const decodeBrowsePathPart = (pathPart: string): string | null => {
    try {
        return decodeURIComponent(pathPart);
    } catch {
        return null;
    }
};

export const getBrowseParamsFromPathParam = (pathParam: string): BrowseProps | null => {
    const sentinelMatch = pathParam.match(/\/-\/(tree|blob|commits|commit)(?:\/|$)/);
    if (!sentinelMatch || sentinelMatch.index === undefined) {
        return null;
    }

    const sentinelIndex = sentinelMatch.index;
    const repoAndRevisionPart = decodeBrowsePathPart(pathParam.substring(0, sentinelIndex));
    if (repoAndRevisionPart === null) {
        return null;
    }

    const lastAtIndex = repoAndRevisionPart.lastIndexOf('@');

    const repoName = lastAtIndex === -1 ? repoAndRevisionPart : repoAndRevisionPart.substring(0, lastAtIndex);
    const revisionName = lastAtIndex === -1 ? undefined : repoAndRevisionPart.substring(lastAtIndex + 1);
    if (!repoName) {
        return null;
    }

    const pathType = sentinelMatch[1] as BrowsePathType;
    const tail = pathParam.substring(sentinelIndex + '/-/'.length + pathType.length);
    const pathPart = tail.startsWith('/') ? tail.substring(1) : tail;
    const decodedPathPart = decodeBrowsePathPart(pathPart);
    if (decodedPathPart === null) {
        return null;
    }

    switch (pathType) {
        case 'tree': {
            return {
                repoName,
                revisionName,
                pathType,
                path: normalizeRepoPath(decodedPathPart),
            };
        }
        case 'commits': {
            return {
                repoName,
                revisionName,
                pathType,
                path: normalizeRepoPath(decodedPathPart),
            };
        }
        case 'commit': {
            // Path suffix on /-/commit/<sha>/<path> is no longer used, but we
            // keep the slash-split here so legacy URLs still resolve to the
            // commit (we just ignore everything after the SHA).
            const firstSlash = decodedPathPart.indexOf('/');
            const commitSha = firstSlash === -1 ? decodedPathPart : decodedPathPart.substring(0, firstSlash);

            if (!commitSha) {
                return null;
            }

            return {
                repoName,
                revisionName,
                pathType,
                commitSha,
                path: '',
            };
        }
        case 'blob': {
            const path = normalizeRepoPath(decodedPathPart);

            if (path === '') {
                return null;
            }

            return {
                repoName,
                revisionName,
                pathType,
                path,
            };
        }
    }
};

export const getBrowsePath = (props: BrowseProps) => {
    const { repoName, revisionName, pathType, setBrowseState } = props;
    const params = new URLSearchParams();

    if (pathType === 'blob' && props.highlightRange) {
        const { start, end } = props.highlightRange;

        if ('column' in start && 'column' in end) {
            params.set(HIGHLIGHT_RANGE_QUERY_PARAM, `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`);
        } else {
            params.set(HIGHLIGHT_RANGE_QUERY_PARAM, `${start.lineNumber},${end.lineNumber}`);
        }
    }

    if (pathType === 'blob' && props.previewRef) {
        params.set(PREVIEW_REF_QUERY_PARAM, props.previewRef);
    }

    if (pathType === 'blob' && props.diff) {
        params.set(DIFF_QUERY_PARAM, 'true');
    }

    if (pathType === 'blob' && props.blame) {
        params.set(BLAME_QUERY_PARAM, 'true');
    }

    if (setBrowseState) {
        params.set(SET_BROWSE_STATE_QUERY_PARAM, JSON.stringify(setBrowseState));
    }

    const tail = pathType === 'commit'
        ? encodeURIComponent(props.commitSha)
        : encodeURIComponent(normalizeRepoPath(props.path));
    const browsePath = `/browse/${repoName}${revisionName ? `@${revisionName}` : ''}/-/${pathType}/${tail}${params.size > 0 ? `?${params.toString()}` : ''}`;
    return browsePath;
};
