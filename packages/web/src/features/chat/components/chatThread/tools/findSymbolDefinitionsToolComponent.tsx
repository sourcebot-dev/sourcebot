'use client';

import { FindSymbolDefinitionsToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { BookOpenIcon } from "lucide-react";


export const FindSymbolDefinitionsToolComponent = ({ part }: { part: FindSymbolDefinitionsToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Resolving definition...';
            case 'input-available':
                return <span>Resolving definition for <CodeSnippet>{part.input.symbol}</CodeSnippet></span>;
            case 'output-error':
                return '"Find symbol definitions" tool call failed';
            case 'output-available':
                return <span>Resolved definition for <CodeSnippet>{part.input.symbol}</CodeSnippet></span>;
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={BookOpenIcon}
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
                                <span className="text-sm text-muted-foreground ml-[25px]">No matches found</span>
                            ) : (
                                <TreeList>
                                    {part.output.map((file) => {
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