'use client';

import { ListTreeToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { FileIcon, FolderIcon } from "lucide-react";

export const ListTreeToolComponent = ({ part }: { part: ListTreeToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Listing directory tree...';
            case 'output-error':
                return '"List tree" tool call failed';
            case 'input-available':
            case 'output-available':
                return 'Listed directory tree';
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={FolderIcon}
                onExpand={setIsExpanded}
                input={part.state !== 'input-streaming' ? JSON.stringify(part.input) : undefined}
                output={part.state === 'output-available' && !isServiceError(part.output) ? part.output.output : undefined}
            />
            {part.state === 'output-available' && isExpanded && (
                <>
                    {isServiceError(part.output) ? (
                        <TreeList>
                            <span>Failed with the following error: <CodeSnippet className="text-sm text-destructive">{part.output.message}</CodeSnippet></span>
                        </TreeList>
                    ) : (
                        <>
                            {part.output.metadata.entries.length === 0 ? (
                                <span className="text-sm text-muted-foreground ml-[25px]">No entries found</span>
                            ) : (
                                <TreeList>
                                    <div className="text-sm text-muted-foreground mb-2">
                                        {part.output.metadata.repo} - {part.output.metadata.path || '/'} ({part.output.metadata.totalReturned} entries{part.output.metadata.truncated ? ', truncated' : ''})
                                    </div>
                                    {part.output.metadata.entries.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${(entry.depth - 1) * 12}px` }}>
                                            {entry.type === 'tree'
                                                ? <FolderIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                : <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            }
                                            <span className="truncate">{entry.name}</span>
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
    );
};
