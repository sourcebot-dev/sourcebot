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

interface NavigateToPathOptions {
    repoName: string;
    revisionName?: string;
    path: string;
    pathType: 'blob' | 'tree';
    highlightRange?: BrowseHighlightRange;
    setBrowseState?: Partial<BrowseState>;
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
    }: NavigateToPathOptions) => {
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

        router.push(`/${domain}/browse/${repoName}@${revisionName}/-/${pathType}/${path}?${params.toString()}`);
    }, [domain, router]);

    return {
        navigateToPath,
    };
}; 