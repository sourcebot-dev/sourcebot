'use client';

import { SearchCodeToolUIPart } from "@/features/chat/tools";
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
import { buildSearchQuery } from "@/features/chat/utils";

export const SearchCodeToolComponent = ({ part }: { part: SearchCodeToolUIPart }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const domain = useDomain();

    const displayQuery = useMemo(() => {
        if (part.state !== 'input-available' && part.state !== 'output-available') {
            return '';
        }

        const query = buildSearchQuery({
            query: part.input.queryRegexp,
            repoNamesFilterRegexp: part.input.repoNamesFilterRegexp,
            languageNamesFilter: part.input.languageNamesFilter,
            fileNamesFilterRegexp: part.input.fileNamesFilterRegexp,
        });

        return query;
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
                            <Link
                                href={createPathWithQueryParams(`/${domain}/search`,
                                    [SearchQueryParams.query, part.output.query],
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