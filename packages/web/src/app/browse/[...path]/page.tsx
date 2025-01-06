import { FileHeader } from "@/app/components/fireHeader";
import { TopBar } from "@/app/components/topBar";
import { Separator } from '@/components/ui/separator';
import { getFileSource, listRepositories } from '@/lib/server/searchService';
import { base64Decode, isServiceError } from "@/lib/utils";
import { CodePreview } from "./codePreview";
import { PageNotFound } from "@/app/components/pageNotFound";
import { ErrorCode } from "@/lib/errorCodes";
import { LuFileX2, LuBookX } from "react-icons/lu";

interface BrowsePageProps {
    params: {
        path: string[];
    };
}

export default async function BrowsePage({
    params,
}: BrowsePageProps) {
    const rawPath = params.path.join('/');
    const sentinalIndex = rawPath.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        return <PageNotFound />;
    }

    const repoName = rawPath.substring(0, sentinalIndex);
    const { path, pathType } = ((): { path: string, pathType: 'tree' | 'blob' } => {
        const path = rawPath.substring(sentinalIndex + '/-/'.length);
        const pathType = path.startsWith('tree/') ? 'tree' : 'blob';
        switch (pathType) {
            case 'tree':
                return {
                    path: path.substring('tree/'.length),
                    pathType,
                };
            case 'blob':
                return {
                    path: path.substring('blob/'.length),
                    pathType,
                };
        }
    })();

    // @todo (bkellam) : We should probably have a endpoint to fetch repository metadata
    // given it's name or id.
    const reposResponse = await listRepositories();
    if (isServiceError(reposResponse)) {
        // @todo : proper error handling
        return (
            <>
                Error: {reposResponse.message}
            </>
        )
    }
    const repo = reposResponse.List.Repos.find(r => r.Repository.Name === repoName);

    if (pathType === 'tree') {
        // @todo : proper tree handling
        return (
            <>
                Tree view not supported
            </>
        )
    }
    
    

    return (
        <div className="flex flex-col h-screen">
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    defaultSearchQuery={`repo:${repoName} `}
                />
                <Separator />
                {repo && (
                    <>
                        <div className="bg-accent py-1 px-2 flex flex-row">
                            <FileHeader
                                fileName={path}
                                repo={repo.Repository}
                                // @todo
                                // branchName={}
                            />
                        </div>
                        <Separator />
                    </>
                )}
            </div>
            {repo === undefined ? (
                <div className="flex h-full">
                    <div className="m-auto flex flex-col items-center gap-2">
                        <LuBookX className="h-12 w-12 text-secondary-foreground" />
                        <span className="font-medium text-secondary-foreground">Repository not found</span>
                    </div>
                </div>
            ) : (
                <CodePreviewWrapper
                    path={path}
                    repoName={repoName}
                />
            )}
        </div>
    )
}

interface CodePreviewWrapper {
    path: string,
    repoName: string,
}

const CodePreviewWrapper = async ({
    path,
    repoName,
}: CodePreviewWrapper) => {
    // @todo: this will depend on `pathType`.
    const fileSourceResponse = await getFileSource({
        fileName: path,
        repository: repoName,
        // @todo: Incorporate branch in path
        branch: 'HEAD'
    });

    if (isServiceError(fileSourceResponse)) {
        if (fileSourceResponse.errorCode === ErrorCode.FILE_NOT_FOUND) {
            return (
                <div className="flex h-full">
                    <div className="m-auto flex flex-col items-center gap-2">
                        <LuFileX2 className="h-12 w-12 text-secondary-foreground" />
                        <span className="font-medium text-secondary-foreground">File not found</span>
                    </div>
                </div>
            )
        }

        // @todo : proper error handling
        return (
            <>
                Error: {fileSourceResponse.message}
            </>
        )
    }

    return (
        <CodePreview
            source={base64Decode(fileSourceResponse.source)}
            language={fileSourceResponse.language}
            repoName={repoName}
            path={path}
        />
    )
}