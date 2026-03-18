'use client';

import { GrepToolUIPart } from "@/features/chat/tools";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { SearchIcon } from "lucide-react";

export const GrepToolComponent = ({ part }: { part: GrepToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayQuery = useMemo(() => {
        if (part.state !== 'input-available' && part.state !== 'output-available') {
            return '';
        }

        return part.input.pattern;
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
                isError={part.state === 'output-error'}
                isExpanded={isExpanded}
                label={label}
                Icon={SearchIcon}
                onExpand={setIsExpanded}
                input={part.state !== 'input-streaming' ? `${JSON.stringify(part.input, null, 2)}\n\nQuery: ${part.output?.metadata.query ?? ''}` : undefined}
                output={part.state === 'output-available' ? part.output.output : undefined}
            />
            {part.state === 'output-available' && isExpanded && (
                <>
                    {part.output.metadata.files.length === 0 ? (
                        <span className="text-sm text-muted-foreground ml-[25px]">No matches found</span>
                    ) : (
                        <TreeList>
                            {part.output.metadata.files.map((file) => {
                                return (
                                    <FileListItem
                                        key={file.path}
                                        path={file.name}
                                        repoName={file.repo}
                                    />
                                )
                            })}
                        </TreeList>
                    )}
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}