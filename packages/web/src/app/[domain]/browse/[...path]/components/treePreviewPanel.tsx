
import { Separator } from "@/components/ui/separator";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { getFolderContents } from "@/features/fileTree/actions";
import { isServiceError } from "@/lib/utils";
import { PureTreePreviewPanel } from "./pureTreePreviewPanel";

interface TreePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    domain: string;
}

export const TreePreviewPanel = async ({ path, repoName, revisionName, domain }: TreePreviewPanelProps) => {
    const [repoInfoResponse, folderContentsResponse] = await Promise.all([
        getRepoInfoByName(repoName, domain),
        getFolderContents({
            repoName,
            revisionName: revisionName ?? 'HEAD',
            path,
        }, domain)
    ]);

    if (isServiceError(folderContentsResponse) || isServiceError(repoInfoResponse)) {
        return <div>Error loading tree preview</div>
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
                        webUrl: repoInfoResponse.webUrl,
                    }}
                    pathType="tree"
                    isFileIconVisible={false}
                    branchDisplayName={revisionName}
                />
            </div>
            <Separator />
            <PureTreePreviewPanel items={folderContentsResponse} />
        </>
    )
}