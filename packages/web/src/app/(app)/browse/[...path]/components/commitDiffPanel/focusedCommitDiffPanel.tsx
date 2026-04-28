import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCommit, getDiff } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import Link from "next/link";
import { formatAuthorsText, getCommitAuthors } from "../../../components/commitAuthors";
import { AuthorsAvatarGroup } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { computeChangeCounts, DiffStat } from "./diffStat";
import { FileStatus, getFileStatus, StatusBadge } from "./fileStatus";
import { LightweightDiffViewer } from "./lightweightDiffViewer";

const FILE_STATUS_LABELS: Record<FileStatus, string> = {
    added: 'Added',
    modified: 'Modified',
    deleted: 'Deleted',
    renamed: 'Renamed',
};

interface FocusedCommitDiffPanelProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
}

// Git's well-known empty-tree SHA. Used as the diff base when the commit has
// no parent (i.e. the initial commit), since `<sha>^` doesn't resolve there.
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export const FocusedCommitDiffPanel = async ({
    repoName,
    revisionName,
    commitSha,
    path,
}: FocusedCommitDiffPanelProps) => {
    const [commitResponse, initialDiffResponse, repoInfoResponse] = await Promise.all([
        getCommit({
            repo: repoName,
            ref: commitSha,
        }),
        getDiff({
            repo: repoName,
            base: `${commitSha}^`,
            head: commitSha,
            path,
        }),
        getRepoInfoByName(repoName),
    ]);

    if (isServiceError(commitResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading commit: {commitResponse.message}
            </div>
        );
    }

    if (isServiceError(repoInfoResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading repo info: {repoInfoResponse.message}
            </div>
        );
    }

    // Initial commit has no parent — `<sha>^` fails. Fall back to diffing
    // against git's empty tree.
    let diffResponse = initialDiffResponse;
    if (isServiceError(initialDiffResponse) && commitResponse.parents.length === 0) {
        diffResponse = await getDiff({
            repo: repoName,
            base: EMPTY_TREE_SHA,
            head: commitSha,
            path,
        });
    }

    if (isServiceError(diffResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading diff: {diffResponse.message}
            </div>
        );
    }

    // Match by either side so deletions (oldPath === path, newPath === null)
    // and renames (oldPath !== newPath) both resolve to the right entry.
    const file = diffResponse.files.find(
        (f) => f.newPath === path || f.oldPath === path,
    );

    const authors = getCommitAuthors(commitResponse);
    const commitDate = new Date(commitResponse.date);
    const relativeDate = formatDistanceToNow(commitDate, { addSuffix: true });
    const absoluteDate = format(commitDate, 'PPpp');

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row py-1 px-2 items-center border-b shrink-0">
                <PathHeader
                    path={path}
                    pathType="blob"
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        externalWebUrl: repoInfoResponse.externalWebUrl,
                    }}
                    revisionName={revisionName}
                />
            </div>
            {file ? (
                <>
                    <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                        <div className="flex flex-row items-center gap-2">
                            <StatusBadge status={getFileStatus(file)} />
                            <h2 className="text-sm font-medium">
                                {FILE_STATUS_LABELS[getFileStatus(file)]}
                            </h2>
                            <span className="text-sm text-muted-foreground">by</span>
                            <AuthorsAvatarGroup authors={authors} />
                            <span
                                className="text-sm font-medium"
                                title={authors.map((a) => a.name).join(", ")}
                            >
                                {formatAuthorsText(authors)}
                            </span>
                            <span
                                className="text-sm text-muted-foreground"
                                title={absoluteDate}
                            >
                                {relativeDate}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <Link
                                href={getBrowsePath({
                                    repoName,
                                    revisionName,
                                    path: '',
                                    pathType: 'commit',
                                    commitSha,
                                })}
                                className="text-sm text-link hover:underline"
                            >
                                View full commit
                            </Link>
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <DiffStat {...computeChangeCounts(file)} />
                            <Tooltip key={commitSha}>
                                <TooltipTrigger>
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground"
                                    >
                                        <Link
                                            href={getBrowsePath({
                                                repoName,
                                                revisionName,
                                                path,
                                                pathType: 'blob',
                                            })}
                                            aria-label="Exit diff view"
                                        >
                                            <X className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Exit diff view</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <LightweightDiffViewer
                            hunks={file.hunks}
                            oldPath={file.oldPath}
                            newPath={file.newPath}
                        />
                    </div>
                </>
            ) : (
                <div className="p-4 text-sm text-muted-foreground">
                    This file was not modified in this commit.
                </div>
            )}
        </div>
    );
};
