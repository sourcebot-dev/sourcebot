'use client';

import { SearchCodeToolRequest, SearchCodeToolResponse } from "@/features/chat/tools";
import { useDomain } from "@/hooks/useDomain";
import { createPathWithQueryParams, isServiceError } from "@/lib/utils";
import { useMemo, useState } from "react";
import { FileListItem, ToolHeader, TreeList } from "./shared";
import { CodeSnippet } from "@/app/components/codeSnippet";
import { Separator } from "@/components/ui/separator";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { SearchQueryParams } from "@/lib/types";
import { PlayIcon } from "@radix-ui/react-icons";


interface SearchCodeToolProps {
    request: SearchCodeToolRequest;
    response?: SearchCodeToolResponse;
}

export const SearchCodeTool = ({ request: request, response }: SearchCodeToolProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const domain = useDomain();

    const label = useMemo(() => {
        if (!response) {
            return `Searching...`;
        }

        if (isServiceError(response)) {
            return `Failed to search code`;
        }

        return `Searched for "${request.query}"`;
    }, [request, response]);

    return (
        <div className="my-4">
            <ToolHeader
                isLoading={response === undefined}
                isError={isServiceError(response)}
                isExpanded={isExpanded}
                label={label}
                Icon={SearchIcon}
                onExpand={setIsExpanded}
            />
            {response !== undefined && isExpanded && (
                <>
                    {isServiceError(response) ? (
                        <TreeList>
                            <span>Failed with the following error: <CodeSnippet className="text-sm text-destructive">{response.message}</CodeSnippet></span>
                        </TreeList>
                    ) : (
                        <>
                            <TreeList>
                                {response.files.map((file) => {
                                    return (
                                        <FileListItem
                                            key={file.fileName}
                                            path={file.fileName}
                                            repoName={file.repository}
                                        />
                                    )
                                })}
                            </TreeList>
                            <Link
                                href={createPathWithQueryParams(`/${domain}/search`,
                                    [SearchQueryParams.query, response.query],
                                )}
                                className='flex flex-row items-center gap-2 text-sm text-muted-foreground mt-2 ml-auto w-fit hover:text-foreground'
                            >
                                <PlayIcon className='h-4 w-4' />
                                Manually run query
                            </Link>
                        </>
                    )}
                    <Separator className='ml-[7px] my-2' />
                </>
            )}
        </div>
    )
}