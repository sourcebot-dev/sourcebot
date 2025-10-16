'use client';

import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";
import { useCallback } from "react";
import { BrowseState } from "../browseStateProvider";
import { getBrowsePath } from "./utils";

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