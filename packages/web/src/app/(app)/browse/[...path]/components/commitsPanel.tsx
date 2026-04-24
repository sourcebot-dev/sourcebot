import { format } from "date-fns";
import { GitCommitHorizontal } from "lucide-react";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Separator } from "@/components/ui/separator";
import { listCommits } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { CommitRow } from "./commitRow";
import { CommitsPagination } from "./commitsPagination";

interface CommitsPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    page: number;
}

const PER_PAGE = 35;

export const CommitsPanel = async ({ path, repoName, revisionName, page }: CommitsPanelProps) => {
    const skip = (page - 1) * PER_PAGE;

    const [commitsResponse, repoInfoResponse] = await Promise.all([
        listCommits({
            repo: repoName,
            path: path || undefined,
            ref: revisionName,
            maxCount: PER_PAGE,
            skip,
        }),
        getRepoInfoByName(repoName),
    ]);

    if (isServiceError(commitsResponse)) {
        return <div className="p-4 text-sm">Error loading commits: {commitsResponse.message}</div>;
    }
    if (isServiceError(repoInfoResponse)) {
        return <div className="p-4 text-sm">Error loading repo info: {repoInfoResponse.message}</div>;
    }

    const { commits, totalCount } = commitsResponse;
    const isLastPage = page * PER_PAGE >= totalCount;

    const groups = new Map<string, { label: string; commits: typeof commits }>();
    for (const commit of commits) {
        const date = new Date(commit.date);
        const key = format(date, "yyyy-MM-dd");
        const label = `Commits on ${format(date, "MMM d, yyyy")}`;
        const existing = groups.get(key);
        if (existing) {
            existing.commits.push(commit);
        } else {
            groups.set(key, { label, commits: [commit] });
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-row py-1 px-2 items-center gap-2">
                <span className="text-sm text-muted-foreground flex-shrink-0">History for</span>
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfoResponse.codeHostType,
                        displayName: repoInfoResponse.displayName,
                        externalWebUrl: repoInfoResponse.externalWebUrl,
                    }}
                    revisionName={revisionName}
                />
            </div>
            <Separator />
            <div className="flex-1 overflow-auto">
                {Array.from(groups.values()).map((group) => (
                    <div key={group.label}>
                        <div className="sticky top-0 z-10 flex flex-row items-center gap-2 px-3 py-2 bg-muted text-sm font-medium text-muted-foreground border-b">
                            <GitCommitHorizontal className="h-4 w-4 flex-shrink-0" />
                            {group.label}
                        </div>
                        {group.commits.map((commit) => (
                            <CommitRow
                                key={commit.hash}
                                commit={commit}
                                repoName={repoName}
                                path={path}
                            />
                        ))}
                    </div>
                ))}
                {isLastPage && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        End of commit history
                    </div>
                )}
                <CommitsPagination
                    page={page}
                    perPage={PER_PAGE}
                    totalCount={totalCount}
                />
            </div>
        </div>
    );
};
