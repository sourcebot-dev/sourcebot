'use client';

import { ListCommitsToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { GitCommitVerticalIcon } from "lucide-react";

export const ListCommitsToolComponent = ({ part }: { part: ListCommitsToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Listing commits...';
            case 'output-error':
                return '"List commits" tool call failed';
            case 'input-available':
            case 'output-available':
                return 'Listed commits';
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={GitCommitVerticalIcon}
                onExpand={setIsExpanded}
            />
            {part.state === 'output-available' && isExpanded && (
                <>
                    {isServiceError(part.output) ? (
                        <TreeList>
                            <span>Failed with the following error: <CodeSnippet className="text-sm text-destructive">{part.output.message}</CodeSnippet></span>
                        </TreeList>
                    ) : (
                        <>
                            {part.output.commits.length === 0 ? (
                                <span className="text-sm text-muted-foreground ml-[25px]">No commits found</span>
                            ) : (
                                <TreeList>
                                    <div className="text-sm text-muted-foreground mb-2">
                                        Found {part.output.commits.length} of {part.output.totalCount} total commits:
                                    </div>
                                    {part.output.commits.map((commit, index) => (
                                        <div key={commit.hash} className="mb-3 last:mb-0">
                                            <div className="flex items-start gap-2 text-sm">
                                                <GitCommitVerticalIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <CodeSnippet className="text-xs font-mono">
                                                            {commit.hash.substring(0, 7)}
                                                        </CodeSnippet>
                                                        {commit.refs && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {commit.refs}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-1 font-medium">
                                                        {commit.message}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                        <span>{commit.author}</span>
                                                        <span>•</span>
                                                        <span>{new Date(commit.date).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </TreeList>
                            )}
                        </>
                    )}
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}
