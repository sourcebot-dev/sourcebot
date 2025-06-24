'use client';

import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";
import { useCallback } from "react";
import { BrowseState, SET_BROWSE_STATE_QUERY_PARAM } from "../browseStateProvider";

export type BrowseHighlightRange = {
    start: { lineNumber: number; column: number; };
    end: { lineNumber: number; column: number; };
} | {
    start: { lineNumber: number; };
    end: { lineNumber: number; };
}

export const HIGHLIGHT_RANGE_QUERY_PARAM = 'highlightRange';

export interface GetBrowsePathProps {
    repoName: string;
    revisionName?: string;
    path: string;
    pathType: 'blob' | 'tree';
    highlightRange?: BrowseHighlightRange;
    setBrowseState?: Partial<BrowseState>;
    domain: string;
}

export const getBrowsePath = ({
    repoName,
    revisionName = 'HEAD',
    path,
    pathType,
    highlightRange,
    setBrowseState,
    domain,
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
    const browsePath = `/${domain}/browse/${repoName}@${revisionName}/-/${pathType}/${encodedPath}${params.size > 0 ? `?${params.toString()}` : ''}`;
    return browsePath;
}


export const useBrowseNavigation = () => {
    const router = useRouter();
    const domain = useDomain();

    const navigateToPath = useCallback(({
        repoName,
        revisionName = 'HEAD',
        path,
        pathType,
        highlightRange,
        setBrowseState,
    }: Omit<GetBrowsePathProps, 'domain'>) => {
        const browsePath = getBrowsePath({
            repoName,
            revisionName,
            path,
            pathType,
            highlightRange,
            setBrowseState,
            domain,
        });

        router.push(browsePath);
    }, [domain, router]);

    return {
        navigateToPath,
    };
}; 