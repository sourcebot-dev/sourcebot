import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel/codePreviewPanel";
import { CommitDiffPanel } from "./components/commitDiffPanel/commitDiffPanel";
import { CommitsPanel } from "./components/commitHistoryPanel/commitsPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel/treePreviewPanel";
import { Metadata } from "next";

/**
 * Parses the URL path to generate a descriptive title.
 * It handles three cases:
 * 1. File view (`blob`): "filename.ts - owner/repo"
 * 2. Directory view (`tree`): "directory/ - owner/repo"
 * 3. Repository root: "owner/repo"
 *
 * @param path The array of path segments from Next.js params.
 * @returns A formatted title string.
 */
const parsePathForTitle = (path: string[]): string => {
    const pathParam = path.join('/');

    const browseProps = getBrowseParamsFromPathParam(pathParam);
    const { repoName, revisionName, path: filePath } = browseProps;

    // Build the base repository and revision string.
    const cleanRepoName = repoName.split('/').slice(1).join('/'); // Remove the version control system prefix
    const repoAndRevision = `${cleanRepoName}${revisionName ? ` @ ${revisionName}` : ''}`;

    switch (browseProps.pathType) {
        case 'blob': {
            // For blobs, get the filename from the end of the path.
            const fileName = filePath.split('/').pop() || filePath;
            return `${fileName} - ${repoAndRevision}`;
        }
        case 'tree': {
            // If the path is empty, it's the repo root.
            if (filePath === '' || filePath === '/') {
                return repoAndRevision;
            }
            // Otherwise, show the directory path.
            const directoryPath = filePath.endsWith('/') ? filePath : `${filePath}/`;
            return `${directoryPath} - ${repoAndRevision}`;
        }
        case 'commits': {
            if (filePath === '' || filePath === '/') {
                return `History - ${repoAndRevision}`;
            }
            return `History: ${filePath} - ${repoAndRevision}`;
        }
        case 'commit': {
            const shortSha = browseProps.commitSha.substring(0, 7);
            return `Commit ${shortSha} - ${repoAndRevision}`;
        }
    }
}

type Props = {
    params: Promise<{
        path: string[];
    }>;
};

export async function generateMetadata({ params: paramsPromise }: Props): Promise<Metadata> {
    let title = 'Browse'; // Default Fallback

    try {
        const params = await paramsPromise;
        title = parsePathForTitle(params.path);

    } catch (error) {
        console.error("Failed to generate metadata title from path:", error);
    }

    return {
        title,
    };
}

interface BrowsePageProps {
    params: Promise<{
        path: string[];
    }>;
    searchParams: Promise<{
        page?: string;
        author?: string;
        since?: string;
        until?: string;
    }>;
}

export default async function BrowsePage(props: BrowsePageProps) {
    const [params, searchParams] = await Promise.all([props.params, props.searchParams]);

    const {
        path: _rawPath,
    } = params;

    const rawPath = _rawPath.join('/');
    const browseProps = getBrowseParamsFromPathParam(rawPath);
    const { repoName, revisionName, path } = browseProps;

    const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
    const author = searchParams.author || undefined;
    const since = searchParams.since || undefined;
    const until = searchParams.until || undefined;

    return (
        <div className="flex flex-col h-full">
            <Suspense fallback={
                <div className="flex flex-col w-full min-h-full items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                </div>
            }>
                {browseProps.pathType === 'blob' ? (
                    <CodePreviewPanel
                        path={path}
                        repoName={repoName}
                        revisionName={revisionName}
                    />
                ) : browseProps.pathType === 'commits' ? (
                    <CommitsPanel
                        path={path}
                        repoName={repoName}
                        revisionName={revisionName}
                        page={page}
                        author={author}
                        since={since}
                        until={until}
                    />
                ) : browseProps.pathType === 'commit' ? (
                    <CommitDiffPanel
                        repoName={repoName}
                        revisionName={revisionName}
                        commitSha={browseProps.commitSha}
                        path={path}
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

