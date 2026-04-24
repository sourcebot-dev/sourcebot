'use client';

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/userAvatar";
import type { Commit } from "@/features/git";
import { getBrowsePath } from "../../hooks/utils";

interface CommitHeaderProps {
    commit: Commit;
    repoName: string;
    path: string;
    revisionName?: string;
}

type Author = { name: string; email: string };

const parseCoAuthors = (body: string): Author[] => {
    const coAuthors: Author[] = [];
    const regex = /^co-authored-by:\s*(.+?)\s*<(.+?)>\s*$/gim;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
        coAuthors.push({ name: match[1].trim(), email: match[2].trim() });
    }
    return coAuthors;
};

const formatAuthorsText = (authors: Author[]): string => {
    if (authors.length === 1) {
        return authors[0].name;
    }
    if (authors.length === 2) {
        return `${authors[0].name} and ${authors[1].name}`;
    }
    const others = authors.length - 2;
    return `${authors[0].name}, ${authors[1].name}, and ${others} other${others > 1 ? "s" : ""}`;
};

export const CommitHeader = ({ commit, repoName, path, revisionName }: CommitHeaderProps) => {
    const [isBodyExpanded, setIsBodyExpanded] = useState(false);
    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const hasBody = commit.body.trim().length > 0;

    const historyHref = getBrowsePath({
        repoName,
        revisionName,
        path,
        pathType: 'commits',
    });

    const authors = useMemo<Author[]>(() => {
        const all: Author[] = [
            { name: commit.authorName, email: commit.authorEmail },
            ...parseCoAuthors(commit.body),
        ];
        const seen = new Set<string>();
        return all.filter((a) => {
            const key = a.email.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }, [commit.authorName, commit.authorEmail, commit.body]);

    const displayedAvatars = authors.slice(0, 2);
    const overflowCount = Math.max(0, authors.length - 2);

    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between gap-4 min-w-0">
                <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                    <AvatarGroup className="flex-shrink-0">
                        {displayedAvatars.map((a) => (
                            <UserAvatar
                                key={a.email}
                                email={a.email}
                                className="h-5 w-5"
                            />
                        ))}
                        {overflowCount > 0 && (
                            <AvatarGroupCount className="size-5 text-xs">
                                +{overflowCount}
                            </AvatarGroupCount>
                        )}
                    </AvatarGroup>
                    <span className="text-sm font-medium flex-shrink-0">
                        {formatAuthorsText(authors)}
                    </span>
                    <span className="text-sm text-muted-foreground truncate" title={commit.message}>
                        {commit.message}
                    </span>
                    {hasBody && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Toggle
                                    pressed={isBodyExpanded}
                                    onPressedChange={setIsBodyExpanded}
                                    aria-label="Open commit details"
                                >
                                    <MoreHorizontal />
                                </Toggle>
                            </TooltipTrigger>
                            <TooltipContent>Open commit details</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div className="flex flex-row items-center gap-3 flex-shrink-0">
                    <div className="flex flex-row items-center gap-1.5">
                        <span className="text-sm font-mono text-muted-foreground" title={commit.hash}>
                            {shortSha}
                        </span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="text-sm text-muted-foreground" title={commit.date}>
                            {relativeDate}
                        </span>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
                        <Link href={historyHref}>
                            <History className="h-4 w-4" />
                            <span className="text-sm">History</span>
                        </Link>
                    </Button>
                </div>
            </div>
            {hasBody && isBodyExpanded && (
                <div className="px-2 py-2 bg-muted/30 border-t">
                    <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
                        {commit.body.trim()}
                    </pre>
                </div>
            )}
        </>
    );
};
