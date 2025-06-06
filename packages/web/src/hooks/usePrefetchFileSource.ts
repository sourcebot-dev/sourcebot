'use client';

import { useQueryClient } from "@tanstack/react-query";
import { useDomain } from "./useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/search/fileSourceApi";
import { useCallback } from "react";

export const usePrefetchFileSource = () => {
    const queryClient = useQueryClient();
    const domain = useDomain();

    const prefetchFileSource = useCallback((repoName: string, revisionName: string, path: string) => {
        queryClient.prefetchQuery({
            queryKey: ['fileSource', repoName, revisionName, path, domain],
            queryFn: () => unwrapServiceError(getFileSource({
                fileName: path,
                repository: repoName,
                branch: revisionName,
            }, domain)),
        });
    }, [queryClient, domain]);

    return { prefetchFileSource };
}