'use client';

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { getBrowsePath, GetBrowsePathProps } from "./utils";

export const useBrowseNavigation = () => {
    const router = useRouter();

    const navigateToPath = useCallback(({
        repoName,
        revisionName = 'HEAD',
        path,
        pathType,
        highlightRange,
        setBrowseState,
    }: GetBrowsePathProps) => {
        const browsePath = getBrowsePath({
            repoName,
            revisionName,
            path,
            pathType,
            highlightRange,
            setBrowseState,
        });

        router.push(browsePath);
    }, [router]);

    return {
        navigateToPath,
    };
};