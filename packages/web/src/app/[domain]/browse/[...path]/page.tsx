import { Suspense } from "react";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import { Loader2 } from "lucide-react";
import { TreePreviewPanel } from "./components/treePreviewPanel";
import { Metadata } from "next";
import { parsePathForTitle} from "@/lib/utils";

type Props = {
  params: {
    domain: string;
    path: string[];
  };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let title = 'Browse'; // Default Fallback

  try {
    title = parsePathForTitle(params.path);

  } catch (error) {
    // TODO: Maybe I need to look into a better way of handling this error.
    // for now, it is just a log, fallback tab title and prevents the app from crashing.
    console.error("Failed to generate metadata title from path:", params.path, error);
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
    console.log("rawPath:", rawPath);
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

