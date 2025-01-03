import { FileHeader } from "@/app/components/fireHeader";
import { TopBar } from "@/app/components/topBar";
import { Separator } from '@/components/ui/separator';
import { getFileSource, listRepositories } from '@/lib/server/searchService';
import { base64Decode, isServiceError } from "@/lib/utils";
import { CodePreview } from "./codePreview";

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
        // @todo : proper error handling
        return (
            <>
                No sentinal found
            </>
        )
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

    if (pathType === 'tree') {
        // @todo : proper tree handling
        return (
            <>
                Tree view not supported
            </>
        )
    }
    
    // @todo: this will depend on `pathType`.
    const fileSourceResponse = await getFileSource({
        fileName: path,
        repository: repoName,
        // @todo: Incorporate branch in path
        branch: 'HEAD'
    });

    if (isServiceError(fileSourceResponse)) {
        // @todo : proper error handling
        return (
            <>
                Error: {fileSourceResponse.message}
            </>
        )
    }

    const reposResponse = await listRepositories();
    if (isServiceError(reposResponse)) {
        // @todo : proper error handling
        return (
            <>
                Error: {reposResponse.message}
            </>
        )
    }

    // @todo (bkellam) : We should probably have a endpoint to fetch repository metadata
    // given it's name or id.
    const repo = reposResponse.List.Repos.find(r => r.Repository.Name === repoName);

    return (
        <div>
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    defaultSearchQuery={`repo:${repoName} `}
                />
                <Separator />
                <div className="bg-accent py-1 px-2 flex flex-row">
                    <FileHeader
                        fileName={path}
                        repo={repo?.Repository}
                        // @todo
                        // branchName={}
                    />
                </div>
                <Separator />
            </div>
            <CodePreview
                source={base64Decode(fileSourceResponse.source)}
                language={fileSourceResponse.language}
            />
        </div>
    )
}