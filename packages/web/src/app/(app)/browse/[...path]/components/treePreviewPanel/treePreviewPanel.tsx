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
        // A 404 means the user hit a typo in a repo name (or a config
        // that's no longer indexed). A different status code is an
        // actual system error. Showing the same generic message for
        // both confuses users — the typo case looks like a sync
        // problem. See issue #1530.
        if (repoInfoResponse.errorCode === 'NOT_FOUND') {
            return <div>Repository not found.</div>;
        }
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
