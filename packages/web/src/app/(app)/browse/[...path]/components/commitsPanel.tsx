import { format } from "date-fns";
import { GitCommitHorizontal } from "lucide-react";
import { getRepoInfoByName } from "@/actions";
import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Separator } from "@/components/ui/separator";
import { listCommitAuthors, listCommits } from "@/features/git";
import { isServiceError } from "@/lib/utils";
import { AuthorFilter } from "./authorFilter";
import { dedupeCommitAuthorsByEmail, escapeGitBreLiteral } from "../../components/commitAuthors";
import { CommitRow } from "./commitRow";
import { CommitsPagination } from "./commitsPagination";
import { DateFilter } from "./dateFilter";

interface CommitsPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    page: number;
    author?: string;
    since?: string;
    until?: string;
}

const COMMITS_PER_PAGE = 35;
const AUTHORS_PER_PAGE = 100;

export const CommitsPanel = async ({ path, repoName, revisionName, page, author, since, until }: CommitsPanelProps) => {
    const skip = (page - 1) * COMMITS_PER_PAGE;

    // The URL stores dates as YYYY-MM-DD. Always pass explicit timestamps to
    // git: the bare-date form triggers approxidate quirks (returning 0 commits
    // in some cases), and bare `--until=YYYY-MM-DD` would also exclude commits
    // made on that day since it resolves to midnight at the start.
    const sinceForGit = since ? `${since}T00:00:00` : undefined;
    const untilForGit = until ? `${until}T23:59:59` : undefined;

    const [commitsResponse, repoInfoResponse, authorsResponse] = await Promise.all([
        listCommits({
            repo: repoName,
            path: path || undefined,
            ref: revisionName,
            author: author ? escapeGitBreLiteral(author) : undefined,
            since: sinceForGit,
            until: untilForGit,
            maxCount: COMMITS_PER_PAGE,
            skip,
        }),
        getRepoInfoByName(repoName),
        listCommitAuthors({
            repo: repoName,
            path: path || undefined,
            ref: revisionName,
            maxCount: AUTHORS_PER_PAGE,
            skip: 0,
        }),
    ]);

    if (isServiceError(commitsResponse)) {
        return <div className="p-4 text-sm">Error loading commits: {commitsResponse.message}</div>;
    }
    if (isServiceError(repoInfoResponse)) {
        return <div className="p-4 text-sm">Error loading repo info: {repoInfoResponse.message}</div>;
    }
    if (isServiceError(authorsResponse)) {
        return <div className="p-4 text-sm">Error loading commit authors: {authorsResponse.message}</div>;
    }

    const authors = dedupeCommitAuthorsByEmail(authorsResponse.authors);
    const { commits, totalCount } = commitsResponse;
    const isLastPage = page * COMMITS_PER_PAGE >= totalCount;

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
            <div className="flex flex-row py-1 px-2 items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-2 min-w-0">
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
                <div className="flex flex-row items-center gap-2 flex-shrink-0">
                    <AuthorFilter authors={authors} selectedAuthor={author} />
                    <DateFilter since={since} until={until} />
                </div>
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
                    perPage={COMMITS_PER_PAGE}
                    totalCount={totalCount}
                    extraParams={{ author, since, until }}
                />
            </div>
        </div>
    );
};
