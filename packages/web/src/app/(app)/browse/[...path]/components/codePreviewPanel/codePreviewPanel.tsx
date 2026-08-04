import { getRepoInfoByName } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { CodePreviewPanelClient } from "./codePreviewPanelClient";

interface CodePreviewPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    // When set, the file's content is fetched at this ref while the
    // surrounding browse context (path header) stays at `revisionName`.
    previewRef?: string;
    // When true, fetch blame data alongside the file source and pass it to
    // the editor so the blame gutter can render.
    blame?: boolean;
}

export const CodePreviewPanel = async ({ path, repoName, revisionName, previewRef, blame }: CodePreviewPanelProps) => {
    const repoInfoResponse = await getRepoInfoByName(repoName);

    if (isServiceError(repoInfoResponse)) {
        return <div>Error loading repo info: {repoInfoResponse.message}</div>
    }

    return (
        <CodePreviewPanelClient
            path={path}
            repoName={repoName}
            revisionName={revisionName}
            previewRef={previewRef}
            blame={blame}
            repo={{
                name: repoInfoResponse.name,
                codeHostType: repoInfoResponse.codeHostType,
                displayName: repoInfoResponse.displayName,
                externalWebUrl: repoInfoResponse.externalWebUrl,
            }}
        />
    )
}
