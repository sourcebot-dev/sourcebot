import { BrowseState, SET_BROWSE_STATE_QUERY_PARAM } from "../browseStateProvider";

export const HIGHLIGHT_RANGE_QUERY_PARAM = 'highlightRange';

export type BrowseHighlightRange = {
    start: { lineNumber: number; column: number; };
    end: { lineNumber: number; column: number; };
} | {
    start: { lineNumber: number; };
    end: { lineNumber: number; };
}

export type BrowsePathType = 'blob' | 'tree' | 'commits';

export interface GetBrowsePathProps {
    repoName: string;
    revisionName?: string;
    path: string;
    pathType: BrowsePathType;
    highlightRange?: BrowseHighlightRange;
    setBrowseState?: Partial<BrowseState>;
}

export const getBrowseParamsFromPathParam = (pathParam: string) => {
    const sentinelIndex = pathParam.search(/\/-\/(tree|blob|commits)/);
    if (sentinelIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain "/-/(tree|blob|commits)/" pattern`);
    }

    const repoAndRevisionPart = decodeURIComponent(pathParam.substring(0, sentinelIndex));
    const lastAtIndex = repoAndRevisionPart.lastIndexOf('@');

    const repoName = lastAtIndex === -1 ? repoAndRevisionPart : repoAndRevisionPart.substring(0, lastAtIndex);
    const revisionName = lastAtIndex === -1 ? undefined : repoAndRevisionPart.substring(lastAtIndex + 1);

    const { path, pathType } = ((): { path: string, pathType: BrowsePathType } => {
        const path = pathParam.substring(sentinelIndex + '/-/'.length);
        const pathType: BrowsePathType = path.startsWith('tree')
            ? 'tree'
            : path.startsWith('commits')
                ? 'commits'
                : 'blob';

        // @note: decodedURIComponent is needed here incase the path contains a space.
        switch (pathType) {
            case 'tree':
                return {
                    path: decodeURIComponent(path.startsWith('tree/') ? path.substring('tree/'.length) : path.substring('tree'.length)),
                    pathType,
                };
            case 'commits':
                return {
                    path: decodeURIComponent(path.startsWith('commits/') ? path.substring('commits/'.length) : path.substring('commits'.length)),
                    pathType,
                };
            case 'blob':
                return {
                    path: decodeURIComponent(path.startsWith('blob/') ? path.substring('blob/'.length) : path.substring('blob'.length)),
                    pathType,
                };
        }
    })();

    // Normalize parsed paths the same way URL generation does, so URLs that
    // happen to contain a leading slash (e.g. legacy bookmarks with `%2F`)
    // don't leak `/foo` into git log args.
    const normalizedPath = path.replace(/^\/+/, '');

    if (pathType === 'blob' && normalizedPath === '') {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain a path for blob type`);
    }

    return {
        repoName,
        revisionName,
        path: normalizedPath,
        pathType,
    }
};

// Repo-relative paths shouldn't have leading slashes — `git log -- /foo` (or
// just `--`) treats them as absolute filesystem paths. Repo root and `/`
// both map to the empty path.
const normalizeRepoPath = (path: string): string => path.replace(/^\/+/, '');

export const getBrowsePath = ({
    repoName, revisionName, path, pathType, highlightRange, setBrowseState,
}: GetBrowsePathProps) => {
    const params = new URLSearchParams();

    if (highlightRange) {
        const { start, end } = highlightRange;

        if ('column' in start && 'column' in end) {
            params.set(HIGHLIGHT_RANGE_QUERY_PARAM, `${start.lineNumber}:${start.column},${end.lineNumber}:${end.column}`);
        } else {
            params.set(HIGHLIGHT_RANGE_QUERY_PARAM, `${start.lineNumber},${end.lineNumber}`);
        }
    }

    if (setBrowseState) {
        params.set(SET_BROWSE_STATE_QUERY_PARAM, JSON.stringify(setBrowseState));
    }

    const encodedPath = encodeURIComponent(normalizeRepoPath(path));
    const browsePath = `/browse/${repoName}${revisionName ? `@${revisionName}` : ''}/-/${pathType}/${encodedPath}${params.size > 0 ? `?${params.toString()}` : ''}`;
    return browsePath;
};

