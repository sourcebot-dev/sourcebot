import { getRepoInfoByName } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { TreePreviewPanelClient } from "./treePreviewPanelClient";

interface TreePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
}

export const TreePreviewPanel = async ({ path, repoName, revisionName }: TreePreviewPanelProps) => {
    const repoInfoResponse = await getRepoInfoByName(repoName);

    if (isServiceError(repoInfoResponse)) {
        return <div>Error loading tree preview</div>
    }

    return (
        <TreePreviewPanelClient
            path={path}
            repoName={repoName}
            revisionName={revisionName}
            repo={{
                name: repoInfoResponse.name,
                codeHostType: repoInfoResponse.codeHostType,
                displayName: repoInfoResponse.displayName,
                externalWebUrl: repoInfoResponse.externalWebUrl,
            }}
        />
    )
}
