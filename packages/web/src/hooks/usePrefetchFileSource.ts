'use client';

import { useQueryClient } from "@tanstack/react-query";
import { useDomain } from "./useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { getFileSource } from "@/features/search/fileSourceApi";
import { useDebounceCallback } from "usehooks-ts";

interface UsePrefetchFileSourceProps {
    debounceDelay?: number;
    staleTime?: number;
}

export const usePrefetchFileSource = ({
    debounceDelay = 200,
    staleTime = 5 * 60 * 1000, // 5 minutes
}: UsePrefetchFileSourceProps = {}) => {
    const queryClient = useQueryClient();
    const domain = useDomain();

    const prefetchFileSource = useDebounceCallback((repoName: string, revisionName: string, path: string) => {
        queryClient.prefetchQuery({
            queryKey: ['fileSource', repoName, revisionName, path, domain],
            queryFn: () => unwrapServiceError(getFileSource({
                fileName: path,
                repository: repoName,
                branch: revisionName,
            }, domain)),
            staleTime,
        });
    }, debounceDelay);

    return { prefetchFileSource };
}