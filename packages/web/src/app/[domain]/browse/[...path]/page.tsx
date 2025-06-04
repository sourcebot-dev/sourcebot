'use client';

import { base64Decode, unwrapServiceError } from "@/lib/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useQuery } from "@tanstack/react-query";
import { getFileSource } from "@/features/search/fileSourceApi";
import { useDomain } from "@/hooks/useDomain";
import { Loader2 } from "lucide-react";

export default function BrowsePage() {
    const { path, repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    const { data: fileSourceResponse, isPending, isError } = useQuery({
        queryKey: ['fileSource', repoName, revisionName, path, domain],
        queryFn: () => unwrapServiceError(getFileSource({
            fileName: path,
            repository: repoName,
            branch: revisionName
        }, domain)),
    });

    if (isPending) {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </div>
        )
    }

    if (isError) {
        return <div>error</div>
    }

    return (
        <CodePreviewPanel
            source={base64Decode(fileSourceResponse.source)}
            language={fileSourceResponse.language}
            repoName={repoName}
            path={path}
            revisionName={revisionName ?? 'HEAD'}
        />
    )
}
