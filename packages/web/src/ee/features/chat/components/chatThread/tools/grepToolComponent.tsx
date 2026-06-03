'use client';

import { GrepFile, GrepMetadata, ToolResult } from "@/features/tools";
import { useMemo } from "react";
import { RepoBadge } from "./repoBadge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { RepoHeader } from "./repoHeader";
import { FileRow } from "./fileRow";

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

    return (
        <HoverCard openDelay={200}>
            <div className="flex items-center gap-2 select-none cursor-default">
                <div className="flex-1 min-w-0">
                    <HoverCardTrigger asChild>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 overflow-hidden">
                            <span className="flex-shrink-0">Searched</span>
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
