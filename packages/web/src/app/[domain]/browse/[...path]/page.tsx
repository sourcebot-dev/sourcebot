import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel";

interface BrowsePageProps {
    params: Promise<{
        path: string[];
    }>;
}

export default async function BrowsePage(props: BrowsePageProps) {
    const params = await props.params;

    const {
        path: _rawPath,
    } = params;

    const rawPath = _rawPath.join('/');
    const { repoName, revisionName, path, pathType } = getBrowseParamsFromPathParam(rawPath);

    return (
        <div className="flex flex-col h-full">
            <Suspense fallback={
                <div className="flex flex-col w-full min-h-full items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            }>
                {pathType === 'blob' ? (
                    <CodePreviewPanel
                        path={path}
                        repoName={repoName}
                        revisionName={revisionName}
                    />
                ) : (
                    <TreePreviewPanel
                        path={path}
                        repoName={repoName}
                        revisionName={revisionName}
                    />
                )}
            </Suspense>
        </div>
    )
}

