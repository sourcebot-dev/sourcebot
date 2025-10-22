'use client';

import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";
import { useCallback } from "react";
import { getBrowsePath, GetBrowsePathProps } from "./utils";

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