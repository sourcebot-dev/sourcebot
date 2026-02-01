import { Separator } from "@/components/ui/separator";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { getFolderContents } from "@/features/fileTree/api";
import { isServiceError } from "@/lib/utils";
import { PureTreePreviewPanel } from "./pureTreePreviewPanel";
import { FolderOpen } from "lucide-react";

interface TreePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
}

export const TreePreviewPanel = async ({ path, repoName, revisionName }: TreePreviewPanelProps) => {
    const [repoInfoResponse, folderContentsResponse] = await Promise.all([
        getRepoInfoByName(repoName),
        getFolderContents({
            repoName,
            revisionName: revisionName ?? 'HEAD',
            path,
        })
    ]);

    if (isServiceError(folderContentsResponse) || isServiceError(repoInfoResponse)) {
        return <div>Error loading tree preview</div>
    }

    if (folderContentsResponse.length === 0) {
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
                        pathType="tree"
                        isFileIconVisible={false}
                        revisionName={revisionName}
                    />
                </div>
                <Separator />
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FolderOpen className="w-16 h-16 mb-4" />
                    <p className="text-sm font-medium">No commits yet</p>
                    <p className="text-xs mt-1">This repository doesn&apos;t have any code yet</p>
                </div>
            </>
        )
    }

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
                    pathType="tree"
                    isFileIconVisible={false}
                    revisionName={revisionName}
                />
            </div>
            <Separator />
            <PureTreePreviewPanel items={folderContentsResponse} />
        </>
    )
}