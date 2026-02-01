'use client';

import { ListReposToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { FolderOpenIcon } from "lucide-react";

export const ListReposToolComponent = ({ part }: { part: ListReposToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Listing repositories...';
            case 'output-error':
                return '"List repositories" tool call failed';
            case 'input-available':
            case 'output-available':
                return 'Listed repositories';
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={FolderOpenIcon}
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
                            {part.output.length === 0 ? (
                                <span className="text-sm text-muted-foreground ml-[25px]">No repositories found</span>
                            ) : (
                                <TreeList>
                                    <div className="text-sm text-muted-foreground mb-2">
                                        Found {part.output.length} repositories:
                                    </div>
                                    {part.output.map((repoName, index) => (
                                        <div key={index} className="flex items-center gap-2 text-sm">
                                            <FolderOpenIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{repoName}</span>
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