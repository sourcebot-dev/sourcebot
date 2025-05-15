import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { getFileSource } from '@/features/search/fileSourceApi';
import { isServiceError } from "@/lib/utils";
import { base64Decode } from "@/lib/utils";
import { CodePreview } from "./codePreview";
import { ErrorCode } from "@/lib/errorCodes";
import { LuFileX2, LuBookX } from "react-icons/lu";
import { getOrgFromDomain } from "@/data/org";
import { notFound } from "next/navigation";
import { ServiceErrorException } from "@/lib/serviceError";
import { getRepoInfoByName } from "@/actions";

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

    const repoInfo = await getRepoInfoByName(repoName, params.domain);
    if (isServiceError(repoInfo) && repoInfo.errorCode !== ErrorCode.NOT_FOUND) {
        throw new ServiceErrorException(repoInfo);
    }

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
                {!isServiceError(repoInfo) && (
                    <>
                        <div className="bg-accent py-1 px-2 flex flex-row">
                            <FileHeader
                                fileName={path}
                                repo={{
                                    name: repoInfo.name,
                                    displayName: repoInfo.displayName,
                                    webUrl: repoInfo.webUrl,
                                    codeHostType: repoInfo.codeHostType,
                                }}
                                branchDisplayName={revisionName}
                            />
                        </div>
                        <Separator />
                    </>
                )}
            </div>
            {isServiceError(repoInfo) ? (
                <div className="flex h-full">
                    <div className="m-auto flex flex-col items-center gap-2">
                        <LuBookX className="h-12 w-12 text-secondary-foreground" />
                        <span className="font-medium text-secondary-foreground">Repository not found</span>
                    </div>
                </div>
            ) : (
                <CodePreviewWrapper
                    path={path}
                    repoName={repoInfo.name}
                    revisionName={revisionName ?? 'HEAD'}
                    domain={params.domain}
                />
            )}
        </div>
    )
}

interface CodePreviewWrapper {
    path: string,
    repoName: string,
    revisionName: string,
    domain: string,
}

const CodePreviewWrapper = async ({
    path,
    repoName,
    revisionName,
    domain,
}: CodePreviewWrapper) => {
    // @todo: this will depend on `pathType`.
    const fileSourceResponse = await getFileSource({
        fileName: path,
        repository: repoName,
        branch: revisionName,
    }, domain);

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