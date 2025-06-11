'use client';

import { useQueryClient } from "@tanstack/react-query";
import { useDomain } from "./useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { getFolderContents } from "@/features/fileTree/actions";
import { useDebounceCallback } from "usehooks-ts";

interface UsePrefetchFolderContentsProps {
    debounceDelay?: number;
    staleTime?: number;
}

export const usePrefetchFolderContents = ({
    debounceDelay = 200,
    staleTime = 5 * 60 * 1000, // 5 minutes
}: UsePrefetchFolderContentsProps = {}) => {
    const queryClient = useQueryClient();
    const domain = useDomain();

    const prefetchFolderContents = useDebounceCallback((repoName: string, revisionName: string, path: string) => {
        queryClient.prefetchQuery({
            queryKey: ['tree', repoName, revisionName, path, domain],
            queryFn: () => unwrapServiceError(
                getFolderContents({
                    repoName,
                    revisionName,
                    path,
                }, domain)
            ),
            staleTime,
        });
    }, debounceDelay);

    return { prefetchFolderContents };
}