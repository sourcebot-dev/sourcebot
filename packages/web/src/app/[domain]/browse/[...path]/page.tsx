import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel";
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
export const parsePathForTitle = (path: string[]): string => {
  const pathParam = path.join('/');

  const { repoName, revisionName, path: filePath, pathType } = getBrowseParamsFromPathParam(pathParam);

  // Build the base repository and revision string.
  const cleanRepoName = repoName.split('/').slice(1).join('/'); // Remove the version control system prefix
  const repoAndRevision = `${cleanRepoName}${revisionName ? ` @ ${revisionName}` : ''}`;

  switch (pathType) {
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
  }
}

type Props = {
  params: Promise<{
    domain: string;
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

