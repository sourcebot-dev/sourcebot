'use client';

import { GlobFile, GlobMetadata, ToolResult } from "@/features/tools";
import { useMemo } from "react";
import { RepoBadge } from "./repoBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { RepoHeader } from "./repoHeader";
import { FileRow } from "./fileRow";

export const GlobToolComponent = (output: ToolResult<GlobMetadata>) => {
    const stats = useMemo(() => {
        const { fileCount, repoCount } = output.metadata;
        const fileLabel = `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`;
        if (fileCount === 0 || repoCount <= 1) {
            return fileLabel;
        }
        const repoLabel = `${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
        return `${fileLabel} · ${repoLabel}`;
    }, [output]);

    const filesByRepo = useMemo(() => {
        const groups = new Map<string, GlobFile[]>();
        for (const file of output.metadata.files) {
            if (!groups.has(file.repo)) {
                groups.set(file.repo, []);
            }
            groups.get(file.repo)!.push(file);
        }
        return groups;
    }, [output.metadata.files]);

    return (
        <HoverCard openDelay={200}>
            <div className="flex items-center gap-2 select-none cursor-default">
                <div className="flex-1 min-w-0">
                    <HoverCardTrigger asChild>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 overflow-hidden">
                            <span className="flex-shrink-0">Searched files</span>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded truncate text-foreground max-w-[300px]">{output.metadata.pattern}</code>
                            {output.metadata.inputRepo && <><span className="flex-shrink-0">in</span><RepoBadge repo={output.metadata.inputRepo} /></>}
                        </span>
                    </HoverCardTrigger>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{stats}</span>
                <Separator orientation="vertical" className="h-3 flex-shrink-0" />
            </div>
            {output.metadata.files.length > 0 && (
                <HoverCardContent align="start" className="w-96 p-0">
                    <div className="overflow-y-auto max-h-72">
                        {Array.from(filesByRepo.entries()).map(([repo, files]) => (
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
                        ))}
                    </div>
                </HoverCardContent>
            )}
        </HoverCard>
    );
}
