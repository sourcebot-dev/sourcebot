'use client';

import { ReadFilesToolRequest, ReadFilesToolResponse, SearchCodeToolRequest, SearchCodeToolResponse, toolNames } from '@/features/chat/tools';
import { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import { ReadFilesTool } from './readFilesTool';
import { SearchCodeTool } from './searchCodeTool';

export const ToolUIPart = ({ part }: { part: ToolInvocationUIPart }) => {
    const {
        toolName,
        state,
        args,
    } = part.toolInvocation;

    return (
        <div className='mb-2 w-full'>
            {
                toolName === toolNames.readFiles ? (
                    <ReadFilesTool
                        request={args as ReadFilesToolRequest}
                        response={state === 'result' ? part.toolInvocation.result as ReadFilesToolResponse : undefined}
                    />
                ) : toolName === toolNames.searchCode ? (
                    <SearchCodeTool
                        request={args as SearchCodeToolRequest}
                        response={state === 'result' ? part.toolInvocation.result as SearchCodeToolResponse : undefined}
                    />
                ) : (
                    <span className='text-sm text-muted-foreground'>Unknown tool: {toolName}</span>
                )
            }
        </div>
    )
}
