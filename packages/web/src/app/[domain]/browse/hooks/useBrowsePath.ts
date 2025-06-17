'use client';

import { useMemo } from "react";
import { getBrowsePath, GetBrowsePathProps } from "./useBrowseNavigation";
import { useDomain } from "@/hooks/useDomain";

export const useBrowsePath = ({
    repoName,
    revisionName,
    path,
    pathType,
    highlightRange,
    setBrowseState,
}: Omit<GetBrowsePathProps, 'domain'>) => {
    const domain = useDomain();

    const browsePath = useMemo(() => {
        return getBrowsePath({
            repoName,
            revisionName,
            path,
            pathType,
            highlightRange,
            setBrowseState,
            domain,
        });
    }, [repoName, revisionName, path, pathType, highlightRange, setBrowseState, domain]);

    return {
        path: browsePath,
    }
}