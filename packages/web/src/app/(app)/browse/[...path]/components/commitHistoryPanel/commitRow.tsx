'use client';

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Code, FileCode } from "lucide-react";
import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { useToast } from "@/components/hooks/use-toast";
import type { Commit, GitObjectPathType } from "@/features/git";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";
import { formatAuthorsText, getCommitAuthors } from "@/app/(app)/browse/components/commitAuthors";
import {
    AuthorsAvatarGroup,
    CommitActionLink,
    CommitBody,
    CommitBodyToggle,
} from "@/app/(app)/browse/components/commitParts";

interface CommitRowProps {
    commit: Commit;
    repoName: string;
    path: string;
    pathType: GitObjectPathType;
}

export const CommitRow = ({ commit, repoName, path, pathType }: CommitRowProps) => {
    const [isBodyExpanded, setIsBodyExpanded] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const shortSha = commit.hash.slice(0, 7);
    const relativeDate = formatDistanceToNow(new Date(commit.date), { addSuffix: true });
    const hasBody = commit.body.trim().length > 0;
    const isBlobPath = pathType === 'blob';

    const authors = useMemo(
        () => getCommitAuthors(commit),
        [commit],
    );

    const viewFileAtCommitHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path,
        pathType: 'blob',
    });

    const viewRepoAtCommitHref = getBrowsePath({
        repoName,
        revisionName: commit.hash,
        path: '',
        pathType: 'tree',
    });

    const commitDiffHref = getBrowsePath({
        repoName,
        path,
        pathType: 'commit',
        commitSha: commit.hash,
    });

    const onCopySha = useCallback(() => {
        navigator.clipboard.writeText(commit.hash).then(() => {
            toast({ description: "✅ Copied commit SHA to clipboard" });
        })
        return true;
    }, [commit.hash, toast]);

    // Navigate to the commit diff when the row is clicked, unless the click
    // originated from an interactive child (button or link) — those keep their
    // own behavior (copy SHA, view file/repo at commit, expand body, etc.).
    const onRowClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('button, a')) {
            return;
        }
        router.push(commitDiffHref);
    }, [router, commitDiffHref]);

    return (
        <>
            <div
                className="flex flex-row py-3 px-3 items-center justify-between gap-4 min-w-0 border-b cursor-pointer hover:bg-muted"
                onClick={onRowClick}
            >
                <div className="flex flex-col gap-1 min-w-0 overflow-hidden">
                    <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                        <span className="text-sm font-medium truncate" title={commit.message}>
                            {commit.message}
                        </span>
                        {hasBody && (
                            <CommitBodyToggle
                                pressed={isBodyExpanded}
                                onPressedChange={setIsBodyExpanded}
                            />
                        )}
                    </div>
                    <div className="flex flex-row items-center gap-2 min-w-0 overflow-hidden">
                        <AuthorsAvatarGroup authors={authors} />
                        <span className="text-sm text-muted-foreground truncate">
                            {formatAuthorsText(authors)} authored {relativeDate}
                        </span>
                    </div>
                </div>
                <div className="flex flex-row items-center gap-1 flex-shrink-0">
                    <span className="text-sm font-mono text-muted-foreground" title={commit.hash}>
                        {shortSha}
                    </span>
                    <CopyIconButton onCopy={onCopySha} />
                    {isBlobPath && (
                        <CommitActionLink
                            href={viewFileAtCommitHref}
                            label="View code at this commit"
                            icon={<FileCode className="h-3 w-3" />}
                        />
                    )}
                    <CommitActionLink
                        href={viewRepoAtCommitHref}
                        label="View repository at this commit"
                        icon={<Code className="h-3 w-3" />}
                    />
                </div>
            </div>
            {hasBody && isBodyExpanded && (
                <CommitBody body={commit.body} className="border-b" />
            )}
        </>
    );
};
