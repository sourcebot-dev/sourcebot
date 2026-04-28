import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCommit, getDiff } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { format } from "date-fns";
import { FileCode } from "lucide-react";
import Link from "next/link";
import { formatAuthorsText, getCommitAuthors } from "../../../components/commitAuthors";
import { AuthorsAvatarGroup } from "../../../components/commitParts";
import { getBrowsePath } from "../../../hooks/utils";
import { CommitHashLine } from "./commitHashLine";
import { CommitMessage } from "./commitMessage";
import { computeTotalChangeCounts, DiffStat } from "./diffStat";
import { FileDiffList } from "./fileDiffList";

interface CommitDiffPanelProps {
    repoName: string;
    revisionName?: string;
    commitSha: string;
    path: string;
}

// Git's well-known empty-tree SHA. Used as the diff base when the commit has
// no parent (i.e. the initial commit), since `<sha>^` doesn't resolve there.
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export const CommitDiffPanel = async ({ repoName, commitSha, path }: CommitDiffPanelProps) => {
    const [commitResponse, initialDiffResponse] = await Promise.all([
        getCommit({ repo: repoName, ref: commitSha }),
        getDiff({ repo: repoName, base: `${commitSha}^`, head: commitSha }),
    ]);

    if (isServiceError(commitResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading commit: {commitResponse.message}
            </div>
        );
    }

    // Initial commit has no parent — `<sha>^` fails. Fall back to diffing
    // against git's empty tree so all files show as added.
    let diffResponse = initialDiffResponse;
    if (isServiceError(initialDiffResponse) && commitResponse.parents.length === 0) {
        diffResponse = await getDiff({
            repo: repoName,
            base: EMPTY_TREE_SHA,
            head: commitSha,
        });
    }

    if (isServiceError(diffResponse)) {
        return (
            <div className="p-6 text-sm text-destructive">
                Error loading diff: {diffResponse.message}
            </div>
        );
    }

    const baseSha = commitResponse.parents.length > 0 ? commitResponse.parents[0] : null;
    const subject = commitResponse.message.split('\n')[0];
    const formattedDate = format(new Date(commitResponse.date), 'MMM d, yyyy');
    const totalChangeCounts = computeTotalChangeCounts(diffResponse.files);
    const authors = getCommitAuthors(commitResponse);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-3 border-b shrink-0">
                <div className="flex flex-row items-start gap-2">
                    <div className="flex-1 min-w-0">
                        <CommitMessage subject={subject} body={commitResponse.body} />
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button asChild variant="outline" size="sm" className="flex-shrink-0">
                                <Link
                                    href={getBrowsePath({
                                        repoName,
                                        revisionName: commitResponse.hash,
                                        path: '',
                                        pathType: 'tree',
                                    })}
                                >
                                    <FileCode className="h-4 w-4 mr-1" />
                                    Browse files
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View code at this commit</TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
                    <AuthorsAvatarGroup authors={authors} />
                    <span
                        className="font-medium text-foreground"
                        title={authors.map((a) => a.name).join(", ")}
                    >
                        {formatAuthorsText(authors)}
                    </span>
                    <span>committed on {formattedDate}</span>
                </div>
                <CommitHashLine
                    repoName={repoName}
                    commitHash={commitResponse.hash}
                    parents={commitResponse.parents}
                />
            </div>
            <div className="flex flex-row items-center justify-between gap-2 px-4 py-2 border-b shrink-0">
                <h2 className="text-sm font-medium">
                    {diffResponse.files.length} file{diffResponse.files.length > 1 ? 's' : ''} changed
                </h2>
                <DiffStat {...totalChangeCounts} />
            </div>
            {diffResponse.files.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No files changed.</div>
            ) : (
                <FileDiffList
                    files={diffResponse.files}
                    repoName={repoName}
                    commitSha={commitSha}
                    parentSha={baseSha}
                    targetPath={path || undefined}
                />
            )}
        </div>
    );
};
