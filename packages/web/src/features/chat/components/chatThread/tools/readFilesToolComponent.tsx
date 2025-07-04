'use client';

import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { ReadFilesToolUIPart } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { EyeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";

export const ReadFilesToolComponent = ({ part }: { part: ReadFilesToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Reading...';
            case 'input-available':
                return `Reading ${part.input.paths.length} files...`;
            case 'output-error':
                return 'Tool call failed';
            case 'output-available':
                if (isServiceError(part.output)) {
                    return 'Failed to read files';
                }
                return `Read ${part.output.length} files`;
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error' || (part.state === 'output-available' && isServiceError(part.output))}
                isExpanded={isExpanded}
                label={label}
                Icon={EyeIcon}
                onExpand={setIsExpanded}
            />
            {part.state === 'output-available' && isExpanded && (
                <>
                    <TreeList>
                        {isServiceError(part.output) ? (
                            <span>Failed with the following error: <CodeSnippet className="text-sm text-destructive">{part.output.message}</CodeSnippet></span>
                        ) : part.output.map((file) => {
                            return (
                                <FileListItem
                                    key={file.path}
                                    path={file.path}
                                    repoName={file.repository}
                                />
                            )
                        })}
                    </TreeList>
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}
