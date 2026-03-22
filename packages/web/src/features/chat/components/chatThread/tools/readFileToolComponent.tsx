'use client';

import { ReadFileMetadata, ToolResult } from "@/features/tools";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { RepoBadge } from "./repoBadge";

export const ReadFileToolComponent = ({ metadata }: ToolResult<ReadFileMetadata>) => {
    const fileName = metadata.path.split('/').pop() ?? metadata.path;
    const href = getBrowsePath({
        repoName: metadata.repo,
        revisionName: metadata.revision,
        path: metadata.path,
        pathType: 'blob',
        domain: SINGLE_TENANT_ORG_DOMAIN,
        highlightRange: (metadata.isTruncated || metadata.startLine > 1) ? {
            start: { lineNumber: metadata.startLine },
            end: { lineNumber: metadata.endLine },
        } : undefined,
    });

    const linesRead = metadata.endLine - metadata.startLine + 1;

    return (
        <div className="flex items-center gap-2 select-none text-sm text-muted-foreground">
            <span className="flex-shrink-0">Read</span>
            <Link
                href={href}
                className="inline-flex items-center gap-1 text-xs bg-muted hover:bg-accent px-1.5 py-0.5 rounded transition-colors min-w-0"
                onClick={(e) => e.stopPropagation()}
            >
                <VscodeFileIcon fileName={fileName} className="flex-shrink-0" />
                <span className="font-medium text-foreground truncate">{fileName}</span>
                {(metadata.isTruncated || metadata.startLine > 1) && (
                    <span className="text-muted-foreground">L{metadata.startLine}-{metadata.endLine}</span>
                )}
            </Link>
            <span className="flex-shrink-0">in</span>
            <RepoBadge repo={metadata.repoInfo} />
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{linesRead} {linesRead === 1 ? 'line' : 'lines'}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
}
