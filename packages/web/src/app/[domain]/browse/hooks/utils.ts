import { BrowseState, SET_BROWSE_STATE_QUERY_PARAM } from "../browseStateProvider";

export const HIGHLIGHT_RANGE_QUERY_PARAM = 'highlightRange';

export type BrowseHighlightRange = {
    start: { lineNumber: number; column: number; };
    end: { lineNumber: number; column: number; };
} | {
    start: { lineNumber: number; };
    end: { lineNumber: number; };
}

export interface GetBrowsePathProps {
    repoName: string;
    revisionName?: string;
    path: string;
    pathType: 'blob' | 'tree';
    highlightRange?: BrowseHighlightRange;
    setBrowseState?: Partial<BrowseState>;
    domain: string;
}

export const getBrowseParamsFromPathParam = (pathParam: string) => {
    const sentinelIndex = pathParam.search(/\/-\/(tree|blob)/);
    if (sentinelIndex === -1) {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain "/-/(tree|blob)/" pattern`);
    }

    const repoAndRevisionPart = decodeURIComponent(pathParam.substring(0, sentinelIndex));
    const lastAtIndex = repoAndRevisionPart.lastIndexOf('@');

    const repoName = lastAtIndex === -1 ? repoAndRevisionPart : repoAndRevisionPart.substring(0, lastAtIndex);
    const revisionName = lastAtIndex === -1 ? undefined : repoAndRevisionPart.substring(lastAtIndex + 1);

    const { path, pathType } = ((): { path: string, pathType: 'tree' | 'blob' } => {
        const path = pathParam.substring(sentinelIndex + '/-/'.length);
        const pathType = path.startsWith('tree') ? 'tree' : 'blob';

        // @note: decodedURIComponent is needed here incase the path contains a space.
        switch (pathType) {
            case 'tree':
                return {
                    path: decodeURIComponent(path.startsWith('tree/') ? path.substring('tree/'.length) : path.substring('tree'.length)),
                    pathType,
                };
            case 'blob':
                return {
                    path: decodeURIComponent(path.startsWith('blob/') ? path.substring('blob/'.length) : path.substring('blob'.length)),
                    pathType,
                };
        }
    })();

    if (pathType === 'blob' && path === '') {
        throw new Error(`Invalid browse pathname: "${pathParam}" - expected to contain a path for blob type`);
    }

    return {
        repoName,
        revisionName,
        path,
        pathType,
    }
};

export const getBrowsePath = ({
    repoName, revisionName, path, pathType, highlightRange, setBrowseState, domain,
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

    const encodedPath = encodeURIComponent(path);
    const browsePath = `/${domain}/browse/${repoName}${revisionName ? `@${revisionName}` : ''}/-/${pathType}/${encodedPath}${params.size > 0 ? `?${params.toString()}` : ''}`;
    return browsePath;
};

