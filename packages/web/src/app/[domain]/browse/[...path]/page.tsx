import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { getFileSource } from '@/features/search/fileSourceApi';
import { listRepositories } from '@/features/search/listReposApi';
import { base64Decode, isServiceError } from "@/lib/utils";
import { CodePreview } from "./codePreview";
import { ErrorCode } from "@/lib/errorCodes";
import { LuFileX2, LuBookX } from "react-icons/lu";
import { getOrgFromDomain } from "@/data/org";
import { notFound } from "next/navigation";
import { ServiceErrorException } from "@/lib/serviceError";
interface BrowsePageProps {
    params: {
        path: string[];
        domain: string;
    };
}

export default async function BrowsePage({
    params,
}: BrowsePageProps) {
    const rawPath = decodeURIComponent(params.path.join('/'));
    const sentinalIndex = rawPath.search(/\/-\/(tree|blob)\//);
    if (sentinalIndex === -1) {
        notFound();
    }

    const repoAndRevisionName = rawPath.substring(0, sentinalIndex).split('@');
    const repoName = repoAndRevisionName[0];
    const revisionName = repoAndRevisionName.length > 1 ? repoAndRevisionName[1] : undefined;

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

    const org = await getOrgFromDomain(params.domain);
    if (!org) {
        notFound();
    }

    // @todo (bkellam) : We should probably have a endpoint to fetch repository metadata
    // given it's name or id.
    const reposResponse = await listRepositories(org.id);
    if (isServiceError(reposResponse)) {
        throw new ServiceErrorException(reposResponse);
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
                    defaultSearchQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
                    domain={params.domain}
                />
                <Separator />
                {repo && (
                    <>
                        <div className="bg-accent py-1 px-2 flex flex-row">
                            <FileHeader
                                fileName={path}
                                repo={repo.Repository}
                                branchDisplayName={revisionName}
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
                    revisionName={revisionName ?? 'HEAD'}
                    orgId={org.id}
                />
            )}
        </div>
    )
}

interface CodePreviewWrapper {
    path: string,
    repoName: string,
    revisionName: string,
    orgId: number,
}

const CodePreviewWrapper = async ({
    path,
    repoName,
    revisionName,
    orgId,
}: CodePreviewWrapper) => {
    // @todo: this will depend on `pathType`.
    const fileSourceResponse = await getFileSource({
        fileName: path,
        repository: repoName,
        branch: revisionName,
    }, orgId);

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

        throw new ServiceErrorException(fileSourceResponse);
    }

    return (
        <CodePreview
            source={base64Decode(fileSourceResponse.source)}
            language={fileSourceResponse.language}
            repoName={repoName}
            path={path}
            revisionName={revisionName}
        />
    )
}