import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { TopBar } from "@/app/[domain]/components/topBar";
import { Separator } from '@/components/ui/separator';
import { getFileSource } from '@/features/search/fileSourceApi';
import { cn, getCodeHostInfoForRepo, isServiceError, measure } from "@/lib/utils";
import { base64Decode } from "@/lib/utils";
import { ErrorCode } from "@/lib/errorCodes";
import { LuFileX2, LuBookX } from "react-icons/lu";
import { notFound } from "next/navigation";
import { ServiceErrorException } from "@/lib/serviceError";
import { getRepoInfoByName } from "@/actions";
import { CodePreviewPanel } from "./components/codePreviewPanel";
import Image from "next/image";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";
import { getTree } from "@/features/fileTree/actions";
import { FileTreePanel } from "@/features/fileTree/components/fileTreePanel";

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
    if (isServiceError(repoInfo)) {
        if (repoInfo.errorCode === ErrorCode.NOT_FOUND) {
            return (
                <div className="flex h-full">
                    <div className="m-auto flex flex-col items-center gap-2">
                        <LuBookX className="h-12 w-12 text-secondary-foreground" />
                        <span className="font-medium text-secondary-foreground">Repository not found</span>
                    </div>
                </div>
            );
        }

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

    const fileSourceResponse = await getFileSource({
        fileName: path,
        repository: repoName,
        branch: revisionName ?? 'HEAD',
    }, params.domain);

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

    const codeHostInfo = getCodeHostInfoForRepo({
        codeHostType: repoInfo.codeHostType,
        name: repoInfo.name,
        displayName: repoInfo.displayName,
        webUrl: repoInfo.webUrl,
    });

    const { data: getTreeResponse } = await measure(() => getTree(repoName, revisionName ?? 'HEAD', params.domain), 'getTree');

    return (
        <>
            <div className='sticky top-0 left-0 right-0 z-10'>
                <TopBar
                    defaultSearchQuery={`repo:${repoName}${revisionName ? ` rev:${revisionName}` : ''} `}
                    domain={params.domain}
                />
                <Separator />
                <div className="bg-accent py-1 px-2 flex flex-row items-center">
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
                    {(fileSourceResponse.webUrl && codeHostInfo) && (
                        <a
                            href={fileSourceResponse.webUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-row items-center gap-2 px-2 py-0.5 rounded-md flex-shrink-0"
                        >
                            <Image
                                src={codeHostInfo.icon}
                                alt={codeHostInfo.codeHostName}
                                className={cn('w-4 h-4 flex-shrink-0', codeHostInfo.iconClassName)}
                            />
                            <span className="text-sm font-medium">Open in {codeHostInfo.codeHostName}</span>
                        </a>
                    )}
                </div>
                <Separator />
            </div>
            <ResizablePanelGroup
                direction="horizontal"
            >
                {isServiceError(getTreeResponse) ? (
                    <span>Error loading file tree</span>
                ) : (
                    <FileTreePanel
                        tree={getTreeResponse.tree}
                        path={path}
                        repoName={repoInfo.name}
                        revisionName={revisionName ?? 'HEAD'}
                    />
                )}
                <AnimatedResizableHandle />
                <CodePreviewPanel
                    source={base64Decode(fileSourceResponse.source)}
                    language={fileSourceResponse.language}
                    repoName={repoInfo.name}
                    path={path}
                    revisionName={revisionName ?? 'HEAD'}
                />
            </ResizablePanelGroup>
        </>
    )
}
