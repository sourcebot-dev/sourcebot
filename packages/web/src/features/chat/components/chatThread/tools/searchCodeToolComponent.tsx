'use client';

import { SearchCodeToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { SearchIcon } from "lucide-react";

export const SearchCodeToolComponent = ({ part }: { part: SearchCodeToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayQuery = useMemo(() => {
        if (part.state !== 'input-available' && part.state !== 'output-available') {
            return '';
        }

        return part.input.query;
    }, [part]);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Searching...';
            case 'output-error':
                return '"Search code" tool call failed';
            case 'input-available':
            case 'output-available':
                return <span>Searched for <CodeSnippet>{displayQuery}</CodeSnippet></span>;
        }
    }, [part, displayQuery]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={SearchIcon}
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
                            {part.output.files.length === 0 ? (
                                <span className="text-sm text-muted-foreground ml-[25px]">No matches found</span>
                            ) : (
                                <TreeList>
                                    {part.output.files.map((file) => {
                                        return (
                                            <FileListItem
                                                key={file.fileName}
                                                path={file.fileName}
                                                repoName={file.repository}
                                            />
                                        )
                                    })}
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