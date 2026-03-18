'use client';

import { Separator } from "@/components/ui/separator";
import { ReadFileToolUIPart } from "@/features/chat/tools";
import { EyeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";

export const ReadFileToolComponent = ({ part }: { part: ReadFileToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Reading...';
            case 'input-available':
                return `Reading ${part.input.path}...`;
            case 'output-error':
                return 'Tool call failed';
            case 'output-available':
                if (part.output.metadata.isTruncated || part.output.metadata.startLine > 1) {
                    return `Read ${part.output.metadata.path} (lines ${part.output.metadata.startLine}–${part.output.metadata.endLine})`;
                }
                return `Read ${part.output.metadata.path}`;
        }
    }, [part]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={part.state !== 'output-available' && part.state !== 'output-error'}
                isError={part.state === 'output-error'}
                isExpanded={isExpanded}
                label={label}
                Icon={EyeIcon}
                onExpand={setIsExpanded}
                input={part.state !== 'input-streaming' ? JSON.stringify(part.input) : undefined}
                output={part.state === 'output-available' ? part.output.output : undefined}
            />
            {part.state === 'output-available' && isExpanded && (
                <>
                    <TreeList>
                        <FileListItem
                            path={part.output.metadata.path}
                            repoName={part.output.metadata.repo}
                        />
                    </TreeList>
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}
