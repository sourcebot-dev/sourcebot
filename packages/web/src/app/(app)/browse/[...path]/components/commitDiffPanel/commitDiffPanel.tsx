import { getCommit, getDiff } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { format } from "date-fns";
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

export const CommitDiffPanel = async ({ repoName, commitSha }: CommitDiffPanelProps) => {
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

    const isMergeCommit = commitResponse.parents.length > 1;
    const baseSha = commitResponse.parents.length > 0 ? commitResponse.parents[0] : null;
    const subject = commitResponse.message.split('\n')[0];
    const formattedDate = format(new Date(commitResponse.date), 'MMM d, yyyy');
    const totalChangeCounts = computeTotalChangeCounts(diffResponse.files);

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 p-4 border-b shrink-0">
                <h1 className="text-lg font-semibold">{subject}</h1>
                <div className="text-sm text-muted-foreground">
                    {commitResponse.authorName} committed on {formattedDate}
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                    {commitResponse.hash.substring(0, 12)}
                    {baseSha && (
                        <> · parent {baseSha.substring(0, 12)}</>
                    )}
                </div>
                {isMergeCommit && (
                    <div className="text-xs text-muted-foreground italic">
                        Merge commit — diff shown against first parent
                    </div>
                )}
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
                />
            )}
        </div>
    );
};
