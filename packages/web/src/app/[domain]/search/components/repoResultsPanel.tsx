'use client';

import { RepoResult, RepositoryInfo } from "@/features/search";
import { useDomain } from "@/hooks/useDomain";
import { createPathWithQueryParams } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { SearchQueryParams } from "@/lib/types";

interface RepoResultsPanelProps {
    repoResults: RepoResult[];
    searchQuery: string;
}

export const RepoResultsPanel = ({ repoResults, searchQuery }: RepoResultsPanelProps) => {
    const domain = useDomain();
    const router = useRouter();

    const navigateToRepo = (repoName: string) => {
        // Replace select:repo with repo:xxx, preserving all other filters
        const newQuery = searchQuery
            .replace(/(?:^|\s)select:repo(?:\s|$)/g, ' ')
            .trim()
            .concat(` repo:${repoName}`)
            .trim();
        const path = createPathWithQueryParams(
            `/${domain}/search`,
            [SearchQueryParams.query, newQuery],
        );
        router.push(path);
    };

    if (repoResults.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No repositories found
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 p-4 overflow-y-auto">
            <div className="text-xs text-muted-foreground mb-2">
                {repoResults.length} {repoResults.length === 1 ? "repository" : "repositories"} matched
            </div>
            {repoResults.map((repo) => (
                <button
                    key={repo.repositoryId}
                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-sm text-left w-full group"
                    onClick={() => navigateToRepo(repo.repository)}
                >
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                            {repo.repositoryInfo?.displayName ?? repo.repository}
                        </span>
                        {repo.repositoryInfo?.displayName && repo.repositoryInfo.displayName !== repo.repository && (
                            <span className="text-xs text-muted-foreground truncate">
                                {repo.repository}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {repo.matchCount} {repo.matchCount === 1 ? "match" : "matches"}
                    </span>
                </button>
            ))}
        </div>
    );
};
