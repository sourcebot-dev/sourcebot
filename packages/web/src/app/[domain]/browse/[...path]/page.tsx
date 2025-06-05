'use client';

import { base64Decode, getCodeHostInfoForRepo, unwrapServiceError } from "@/lib/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { useBrowseParams } from "@/app/[domain]/browse/hooks/useBrowseParams";
import { useQuery } from "@tanstack/react-query";
import { getFileSource } from "@/features/search/fileSourceApi";
import { useDomain } from "@/hooks/useDomain";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getRepoInfoByName } from "@/actions";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { FileHeader } from "../../components/fileHeader";
import { useMemo } from "react";

export default function BrowsePage() {
    const { path, repoName, revisionName } = useBrowseParams();
    const domain = useDomain();

    const { data: fileSourceResponse, isPending: isFileSourcePending, isError: isFileSourceError } = useQuery({
        queryKey: ['fileSource', repoName, revisionName, path, domain],
        queryFn: () => unwrapServiceError(getFileSource({
            fileName: path,
            repository: repoName,
            branch: revisionName
        }, domain)),
    });

    const { data: repoInfoResponse, isPending: isRepoInfoPending, isError: isRepoInfoError } = useQuery({
        queryKey: ['repoInfo', repoName, domain],
        queryFn: () => unwrapServiceError(getRepoInfoByName(repoName, domain)),
    });

    const codeHostInfo = useMemo(() => {
        if (!repoInfoResponse) {
            return undefined;
        }

        return getCodeHostInfoForRepo({
            codeHostType: repoInfoResponse.codeHostType,
            name: repoInfoResponse.name,
            displayName: repoInfoResponse.displayName,
            webUrl: repoInfoResponse.webUrl,
        });
    }, [repoInfoResponse]);

    if (isFileSourcePending || isRepoInfoPending) {
        return (
            <div className="flex flex-col w-full min-h-full items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
            </div>
        )
    }

    if (isFileSourceError || isRepoInfoError) {
        return <div>error</div>
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <FileHeader
                    fileName={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        webUrl: repoInfoResponse.webUrl,
                    }}
                />
                {(fileSourceResponse.webUrl && codeHostInfo) && (
                    <a
                        href={fileSourceResponse.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-row items-center gap-2 px-2 py-0.5 rounded-md flex-shrink-0"
                    >
                        <Image
                            src={codeHostInfo.icon}
                            alt={codeHostInfo.codeHostName}
                            className={cn('w-4 h-4 flex-shrink-0', codeHostInfo.iconClassName)}
                        />
                        <span className="text-sm font-medium">Open in {codeHostInfo.codeHostName}</span>
                    </a>
                )}
            </div>
            <Separator />
            <CodePreviewPanel
                source={base64Decode(fileSourceResponse.source)}
                language={fileSourceResponse.language}
                repoName={repoName}
                path={path}
                revisionName={revisionName ?? 'HEAD'}
            />
        </div>
    )
}
