import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel";

interface BrowsePageProps {
    params: {
        path: string[];
        domain: string;
    };
}

export default async function BrowsePage({ params: { path: _rawPath, domain } }: BrowsePageProps) {
    const rawPath = decodeURIComponent(_rawPath.join('/'));
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
                        domain={domain}
                    />
                ) : (
                    <TreePreviewPanel
                        path={path}
                        repoName={repoName}
                        revisionName={revisionName}
                        domain={domain}
                    />
                )}
            </Suspense>
        </div>
    )
}

