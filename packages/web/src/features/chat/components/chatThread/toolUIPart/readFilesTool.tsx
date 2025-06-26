'use client';

import { ReadFilesToolRequest, ReadFilesToolResponse } from "@/features/chat/tools";
import { isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";
import { EyeIcon } from "lucide-react";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";


type ReadFilesToolComponentProps = {
    request: ReadFilesToolRequest;
    response?: ReadFilesToolResponse;
}


export const ReadFilesTool = ({ request, response }: ReadFilesToolComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const label = useMemo(() => {
        if (!response) {
            return `Reading ${request.paths.length} files...`;
        }

        if (isServiceError(response)) {
            return `Failed to read files`;
        }

        return `Read ${response.length} files`;
    }, [request, response]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={response === undefined}
                isError={isServiceError(response)}
                isExpanded={isExpanded}
                label={label}
                Icon={EyeIcon}
                onExpand={setIsExpanded}
            />
            {response !== undefined && isExpanded && (
                <>
                    <TreeList>
                        {isServiceError(response) ? (
                            <span>Failed with the following error: <CodeSnippet className="text-sm text-destructive">{response.message}</CodeSnippet></span>
                        ) : response.map((file) => {
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