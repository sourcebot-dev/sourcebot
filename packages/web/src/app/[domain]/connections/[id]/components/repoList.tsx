'use client';

import { useDomain } from "@/hooks/useDomain";
import { useQuery } from "@tanstack/react-query";
import { flagReposForIndex, getRepos } from "@/actions";
import { RepoListItem } from "./repoListItem";
import { isServiceError } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RepoIndexingStatus } from "@sourcebot/db";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCallback, useMemo, useState } from "react";
import { RepoListItemSkeleton } from "./repoListItemSkeleton";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/multi-select";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useToast } from "@/components/hooks/use-toast";

interface RepoListProps {
    connectionId: number;
}

const getPriority = (status: RepoIndexingStatus) => {
    switch (status) {
        case RepoIndexingStatus.FAILED:
            return 0
        case RepoIndexingStatus.IN_INDEX_QUEUE:
        case RepoIndexingStatus.INDEXING:
            return 1
        case RepoIndexingStatus.INDEXED:
            return 2
        default:
            return 3
    }
}

const convertIndexingStatus = (status: RepoIndexingStatus) => {
    switch (status) {
        case RepoIndexingStatus.FAILED:
            return 'failed';
        case RepoIndexingStatus.NEW:
            return 'waiting';
        case RepoIndexingStatus.IN_INDEX_QUEUE:
        case RepoIndexingStatus.INDEXING:
            return 'running';
        case RepoIndexingStatus.INDEXED:
            return 'succeeded';
        default:
            return 'unknown';
    }
}

export const RepoList = ({ connectionId }: RepoListProps) => {
    const domain = useDomain();
    const router = useRouter();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const captureEvent = useCaptureEvent();
    const [isRetryAllFailedReposLoading, setIsRetryAllFailedReposLoading] = useState(false);

    const { data: unfilteredRepos, isLoading, refetch } = useQuery({
        queryKey: ['repos', connectionId],
        queryFn: async () => {
            const repos = await getRepos(domain, { connectionId });
            if (isServiceError(repos)) {
                return repos;
            }

            return repos.sort((a, b) => {
                const priorityA = getPriority(a.repoIndexingStatus);
                const priorityB = getPriority(b.repoIndexingStatus);

                // First sort by priority
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                // If same priority, sort by indexedAt
                return new Date(a.indexedAt ?? new Date()).getTime() - new Date(b.indexedAt ?? new Date()).getTime();
            });
        },
        refetchInterval: (query) => query.state.error ? false : NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    const failedRepos = useMemo(() => {
        if (isServiceError(unfilteredRepos)) {
            return [];
        }

        return unfilteredRepos?.filter((repo) => repo.repoIndexingStatus === RepoIndexingStatus.FAILED) ?? [];
    }, [unfilteredRepos]);


    const onRetryAllFailedRepos = useCallback(() => {
        if (failedRepos.length === 0) {
            return;
        }

        setIsRetryAllFailedReposLoading(true);
        flagReposForIndex(failedRepos.map((repo) => repo.repoId), domain)
            .then((response) => {
                if (isServiceError(response)) {
                    captureEvent('wa_connection_retry_all_failed_repos_fail', {});
                    toast({
                        description: `❌ Failed to flag repositories for indexing. Reason: ${response.message}`,
                    });
                } else {
                    captureEvent('wa_connection_retry_all_failed_repos_success', {});
                    toast({
                        description: `✅ ${failedRepos.length} repositories flagged for indexing.`,
                    });
                }
            })
            .then(() => { refetch() })
            .finally(() => {
                setIsRetryAllFailedReposLoading(false);
            });
    }, [captureEvent, domain, failedRepos, refetch, toast]);

    const filteredRepos = useMemo(() => {
        if (isServiceError(unfilteredRepos)) {
            return unfilteredRepos;
        }

        const searchLower = searchQuery.toLowerCase();
        return unfilteredRepos?.filter((repo) => {
                return repo.repoName.toLowerCase().includes(searchLower);
            }).filter((repo) => {
                if (selectedStatuses.length === 0) {
                    return true;
                }

                return selectedStatuses.includes(convertIndexingStatus(repo.repoIndexingStatus));
            });
    }, [unfilteredRepos, searchQuery, selectedStatuses]);

    if (isServiceError(filteredRepos)) {
        return <div className="text-destructive">
            {`Error loading repositories. Reason: ${filteredRepos.message}`}
        </div>
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-4 flex-col sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter by name"
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <MultiSelect
                    className="bg-background hover:bg-background w-96"
                    options={[
                        { value: 'waiting', label: 'Waiting' },
                        { value: 'running', label: 'Running' },
                        { value: 'succeeded', label: 'Succeeded' },
                        { value: 'failed', label: 'Failed' },
                    ]}
                    onValueChange={(value) => setSelectedStatuses(value)}
                    defaultValue={[]}
                    placeholder="Filter by status"
                    maxCount={2}
                    animation={0}
                />

                {failedRepos.length > 0 && (
                    <Button
                        variant="outline"
                        disabled={isRetryAllFailedReposLoading}
                        onClick={onRetryAllFailedRepos}
                    >
                        {isRetryAllFailedReposLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Retry All Failed
                    </Button>
                )}
            </div>
            <ScrollArea className="mt-4 max-h-96 overflow-scroll">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <RepoListItemSkeleton key={i} />
                        ))}
                    </div>
                ) : (!filteredRepos || filteredRepos.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-96 p-4 border rounded-lg">
                        <p className="font-medium text-sm">No Repositories Found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {filteredRepos?.length === 0 && searchQuery.length > 0 ? "No repositories found matching your filters." : (
                                <Button
                                    onClick={() => {
                                        router.push(`?tab=settings`)
                                    }}
                                    variant="outline"
                                >
                                    Configure connection
                                </Button>
                            )}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredRepos?.map((repo) => (
                            <RepoListItem
                                key={repo.repoId}
                                imageUrl={repo.imageUrl}
                                name={repo.repoName}
                                indexedAt={repo.indexedAt}
                                status={repo.repoIndexingStatus}
                                repoId={repo.repoId}
                                domain={domain}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
