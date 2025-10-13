import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel";
import { Metadata } from "next";
import { parseRepoPath } from "@/lib/utils";

type Props = {
  params: {
    domain: string;
    path: string[];
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let title = 'Browse'; // Current Default

  try {
    const parsedInfo = parseRepoPath(params.path);

    if (parsedInfo) {
      const { fullRepoName, revision } = parsedInfo;
      title = `${fullRepoName}${revision ? ` @ ${revision}` : ''}`;
    }
  } catch (error) {
    // Log the error for debugging, but don't crash the page render.
    console.error("Failed to generate metadata title from path:", params.path, error);
  }

  return {
    title, // e.g., "sourcebot-dev/sourcebot @ HEAD"
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

