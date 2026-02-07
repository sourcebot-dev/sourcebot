import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { Separator } from "@/components/ui/separator";
import { cn, getCodeHostInfoForRepo, isServiceError } from "@/lib/utils";
import Image from "next/image";
import { CodePreviewPanelClient } from "./codePreviewPanelClient";
import { getFileSource } from '@/features/git';

interface CodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
}

export const CodePreviewPanel = async ({ path, repoName, revisionName }: CodePreviewPanelProps) => {
    const [fileSourceResponse, repoInfoResponse] = await Promise.all([
        getFileSource({
            path,
            repo: repoName,
            ref: revisionName,
        }),
        getRepoInfoByName(repoName),
    ]);

    if (isServiceError(fileSourceResponse)) {
        return <div>Error loading file source: {fileSourceResponse.message}</div>
    }

    if (isServiceError(repoInfoResponse)) {
        return <div>Error loading repo info: {repoInfoResponse.message}</div>
    }

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repoInfoResponse.codeHostType,
        name: repoInfoResponse.name,
        displayName: repoInfoResponse.displayName,
        externalWebUrl: repoInfoResponse.externalWebUrl,
    });

    // @todo: this is a hack to support linking to files for ADO. ADO doesn't support web urls with HEAD so we replace it with main. THis
    // will break if the default branch is not main.
    const fileWebUrl = repoInfoResponse.codeHostType === "azuredevops" && fileSourceResponse.externalWebUrl ?
        fileSourceResponse.externalWebUrl.replace("version=GBHEAD", "version=GBmain") : fileSourceResponse.externalWebUrl;

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        externalWebUrl: repoInfoResponse.externalWebUrl,
                    }}
                    revisionName={revisionName}
                />

                {fileWebUrl && (

                    <a
                        href={fileWebUrl}
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
            <CodePreviewPanelClient
                source={fileSourceResponse.source}
                language={fileSourceResponse.language}
                repoName={repoName}
                path={path}
                revisionName={revisionName ?? 'HEAD'}
            />
        </>
    )
}