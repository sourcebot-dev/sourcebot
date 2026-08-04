import { getRepoInfoByName } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { FocusedCommitDiffPanelClient } from "./focusedCommitDiffPanelClient";

interface FocusedCommitDiffPanelProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
}

export const FocusedCommitDiffPanel = async ({
    repoName,
    revisionName,
    commitSha,
    path,
}: FocusedCommitDiffPanelProps) => {
    const repoInfoResponse = await getRepoInfoByName(repoName);

    if (isServiceError(repoInfoResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading repo info: {repoInfoResponse.message}
            </div>
        );
    }

    return (
        <FocusedCommitDiffPanelClient
            repoName={repoName}
            revisionName={revisionName}
            commitSha={commitSha}
            path={path}
            repo={{
                name: repoInfoResponse.name,
                codeHostType: repoInfoResponse.codeHostType,
                displayName: repoInfoResponse.displayName,
                externalWebUrl: repoInfoResponse.externalWebUrl,
            }}
        />
    );
};
