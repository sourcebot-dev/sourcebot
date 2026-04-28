import { BrowseState, SET_BROWSE_STATE_QUERY_PARAM } from "../browseStateProvider";

export const HIGHLIGHT_RANGE_QUERY_PARAM = 'highlightRange';
export const PREVIEW_REF_QUERY_PARAM = 'ref';
export const DIFF_QUERY_PARAM = 'diff';

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

export const getBrowseParamsFromPathParam = (pathParam: string): BrowseProps => {
    // @note: order matters — `commits` must come before `commit` so the regex
    // engine doesn't greedily match `commit` against `/-/commits/...`.
    const sentinelIndex = pathParam.search(/\/-\/(tree|blob|commits|commit)/);
    if (sentinelIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain "/-/(tree|blob|commits|commit)/" pattern`);
    }

    const repoAndRevisionPart = decodeURIComponent(pathParam.substring(0, sentinelIndex));
    const lastAtIndex = repoAndRevisionPart.lastIndexOf('@');

    const repoName = lastAtIndex === -1 ? repoAndRevisionPart : repoAndRevisionPart.substring(0, lastAtIndex);
    const revisionName = lastAtIndex === -1 ? undefined : repoAndRevisionPart.substring(lastAtIndex + 1);

    const tail = pathParam.substring(sentinelIndex + '/-/'.length);
    const pathType = ((): BrowsePathType => {
        if (tail.startsWith('tree')) {
            return 'tree';
        }
        else if (tail.startsWith('commits')) {
            return 'commits';
        }
        else if (tail.startsWith('commit')) {
            return 'commit';
        }

        return 'blob';
    })();

    // @note: decodeURIComponent is needed in case the path contains a space.
    switch (pathType) {
        case 'tree': {
            const rest = tail.startsWith('tree/') ? tail.substring('tree/'.length) : tail.substring('tree'.length);
            return {
                repoName,
                revisionName,
                pathType,
                path: normalizeRepoPath(decodeURIComponent(rest)),
            };
        }
        case 'commits': {
            const rest = tail.startsWith('commits/') ? tail.substring('commits/'.length) : tail.substring('commits'.length);
            return {
                repoName,
                revisionName,
                pathType,
                path: normalizeRepoPath(decodeURIComponent(rest)),
            };
        }
        case 'commit': {
            // Path suffix on /-/commit/<sha>/<path> is no longer used, but we
            // keep the slash-split here so legacy URLs still resolve to the
            // commit (we just ignore everything after the SHA).
            const rest = tail.startsWith('commit/') ? tail.substring('commit/'.length) : tail.substring('commit'.length);
            const firstSlash = rest.indexOf('/');
            const commitSha = decodeURIComponent(firstSlash === -1 ? rest : rest.substring(0, firstSlash));

            if (!commitSha) {
                throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain a commit SHA for commit type`);
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
            const rest = tail.startsWith('blob/') ? tail.substring('blob/'.length) : tail.substring('blob'.length);
            const path = normalizeRepoPath(decodeURIComponent(rest));

            if (path === '') {
                throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain a path for blob type`);
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

    if (setBrowseState) {
        params.set(SET_BROWSE_STATE_QUERY_PARAM, JSON.stringify(setBrowseState));
    }

    const tail = pathType === 'commit'
        ? encodeURIComponent(props.commitSha)
        : encodeURIComponent(normalizeRepoPath(props.path));
    const browsePath = `/browse/${repoName}${revisionName ? `@${revisionName}` : ''}/-/${pathType}/${tail}${params.size > 0 ? `?${params.toString()}` : ''}`;
    return browsePath;
};
