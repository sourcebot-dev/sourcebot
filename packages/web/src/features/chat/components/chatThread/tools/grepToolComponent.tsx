'use client';

import { GrepFile, GrepMetadata, GrepRepoInfo, ToolResult } from "@/features/tools";
import { useMemo } from "react";
import { RepoBadge } from "./repoBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { cn, getCodeHostIcon } from "@/lib/utils";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export const GrepToolComponent = (output: ToolResult<GrepMetadata>) => {
    const stats = useMemo(() => {
        const { matchCount, repoCount } = output.metadata;
        const matchLabel = `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`;
        if (matchCount === 0 || repoCount === 1) {
            return matchLabel;
        }
        const repoLabel = `${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
        return `${matchLabel} · ${repoLabel}`;
    }, [output]);

    const filesByRepo = useMemo(() => {
        const groups = new Map<string, GrepFile[]>();
        for (const file of output.metadata.files) {
            if (!groups.has(file.repo)) {
                groups.set(file.repo, []);
            }
            groups.get(file.repo)!.push(file);
        }
        return groups;
    }, [output.metadata.files]);

    const singleRepo = output.metadata.repoCount === 1
        ? output.metadata.repoInfoMap[output.metadata.files[0]?.repo]
        : undefined;

    return (
        <HoverCard openDelay={200}>
            <div className="flex items-center gap-2 select-none cursor-default">
                <div className="flex-1 min-w-0">
                    <HoverCardTrigger asChild>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 overflow-hidden">
                            <span className="flex-shrink-0">Searched</span>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded truncate text-foreground max-w-[300px]">{output.metadata.pattern}</code>
                            {singleRepo && <><span className="flex-shrink-0">in</span><RepoBadge repo={singleRepo} /></>}
                        </span>
                    </HoverCardTrigger>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{stats}</span>
                <Separator orientation="vertical" className="h-3 flex-shrink-0" />
            </div>
            {output.metadata.files.length > 0 && (
                <HoverCardContent align="start" className="w-96 p-0">
                    <div className="overflow-y-auto max-h-72">
                        {output.metadata.groupByRepo ? (
                            Array.from(filesByRepo.keys()).map((repo) => (
                                <RepoHeader
                                    key={repo}
                                    repo={output.metadata.repoInfoMap[repo]}
                                    repoName={repo}
                                    isPrimary={true}
                                />
                            ))
                        ) : (
                            Array.from(filesByRepo.entries()).map(([repo, files]) => (
                                <div key={repo}>
                                    <RepoHeader
                                        repo={output.metadata.repoInfoMap[repo]}
                                        repoName={repo}
                                        isPrimary={false}
                                    />
                                    {files.map((file) => (
                                        <FileRow key={`${file.repo}:${file.path}`} file={file} />
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </HoverCardContent>
            )}
        </HoverCard>
    );
}

const RepoHeader = ({ repo, repoName, isPrimary }: { repo: GrepRepoInfo | undefined; repoName: string; isPrimary: boolean }) => {
    const displayName = repo?.displayName ?? repoName.split('/').slice(1).join('/');
    const icon = repo ? getCodeHostIcon(repo.codeHostType) : null;

    const href = getBrowsePath({
        repoName: repoName,
        path: '',
        pathType: 'tree',
        domain: SINGLE_TENANT_ORG_DOMAIN,
    });

    const className = cn("top-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-popover border-b border-border",
        {
            'sticky text-muted-foreground': !isPrimary,
            'text-foreground cursor-pointer hover:bg-accent transition-colors': isPrimary,
        }
    )

    const Content = (
        <>
            {icon && (
                <Image src={icon.src} alt={repo!.codeHostType} width={12} height={12} className={icon.className} />
            )}
            <span>{displayName}</span>
        </>
    )

    if (isPrimary) {
        return (
            <Link
                className={className}
                href={href}
            >
                {Content}
            </Link>
        )
    } else {
        return (
            <div className={className}>
                {Content}
            </div>
        )
    }
}

const FileRow = ({ file }: { file: GrepFile }) => {
    const dir = file.path.includes('/')
        ? file.path.split('/').slice(0, -1).join('/')
        : '';

    const href = getBrowsePath({
        repoName: file.repo,
        revisionName: file.revision,
        path: file.path,
        pathType: 'blob',
        domain: SINGLE_TENANT_ORG_DOMAIN,
    });

    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-3 py-1 hover:bg-accent transition-colors"
        >
            <VscodeFileIcon fileName={file.name} className="flex-shrink-0" />
            <span className="text-sm font-medium flex-shrink-0">{file.name}</span>
            {dir && (
                <>
                    <span className="text-xs text-muted-foreground flex-shrink-0">·</span>
                    <span className="block text-xs text-muted-foreground truncate-start flex-1"><span>{dir}</span></span>
                </>
            )}
        </Link>
    );
}
