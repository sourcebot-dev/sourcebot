'use client';

import { useQueryClient } from "@tanstack/react-query";
import { useDomain } from "./useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { useCallback } from "react";
import { getFolderContents } from "@/features/fileTree/actions";

export const usePrefetchFolderContents = () => {
    const queryClient = useQueryClient();
    const domain = useDomain();

    const prefetchFolderContents = useCallback((repoName: string, revisionName: string, path: string) => {
        queryClient.prefetchQuery({
            queryKey: ['tree', repoName, revisionName, path, domain],
            queryFn: () => unwrapServiceError(
                getFolderContents({
                    repoName,
                    revisionName,
                    path,
                }, domain)
            ),
        });
    }, [queryClient, domain]);

    return { prefetchFolderContents };
}