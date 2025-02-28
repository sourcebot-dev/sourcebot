"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns, RepositoryColumnInfo } from "./columns";
import { listRepositories } from "@/lib/server/searchService";
import { isServiceError, unwrapServiceError } from "@/lib/utils";
import { getRepos } from "@/actions";
import { useQuery } from "@tanstack/react-query";
import { NEXT_PUBLIC_POLLING_INTERVAL_MS } from "@/lib/environment.client";
import { useEffect, useState } from "react";
import { useDomain } from "@/hooks/useDomain";
import { RepoIndexingStatus } from "@sourcebot/db";
import { useMemo } from "react";
import { ListRepositoriesResponse } from "@/lib/types";

export const RepositoryTable = async ({ orgId }: { orgId: number }) => {
    const [rawRepos, setRawRepos] = useState<ListRepositoriesResponse>([]);

    const domain = useDomain();
    const { data: dbRepos, isPending: isReposPending, error: reposError } = useQuery({
        queryKey: ['repos', domain],
        queryFn: async () => {
            return await unwrapServiceError(getRepos(domain, { status: [RepoIndexingStatus.INDEXED] }));
        },
        refetchInterval: NEXT_PUBLIC_POLLING_INTERVAL_MS,
    });

    useEffect(() => {
        const fetchRawRepos = async () => {
            const rawRepos = await listRepositories(orgId);
            if (isServiceError(rawRepos)) {
                console.error(rawRepos);
            } else {
                setRawRepos(rawRepos);
            }
        }

        fetchRawRepos();
    }, [orgId]);

    const augmentedRepos = useMemo(() => {
        if (isReposPending || reposError) {
            return [];
        }

        return rawRepos.List.Repos.map((repo) => {
            return {
                ...repo,
            }
        });
    }, [rawRepos, dbRepos, isReposPending, reposError]);


    const tableRepos = rawRepos?.List.Repos.map((repo): RepositoryColumnInfo => {
        return {
            name: repo.Repository.Name,
            branches: (repo.Repository.Branches ?? []).map((branch) => {
                return {
                    name: branch.Name,
                    version: branch.Version,
                }
            }),
            repoSizeBytes: repo.Stats.ContentBytes,
            indexSizeBytes: repo.Stats.IndexBytes,
            shardCount: repo.Stats.Shards,
            lastIndexed: repo.IndexMetadata.IndexTime,
            latestCommit: repo.Repository.LatestCommitDate,
            indexedFiles: repo.Stats.Documents,
            commitUrlTemplate: repo.Repository.CommitURLTemplate,
            url: repo.Repository.URL,
        }
    }).sort((a, b) => {
        return new Date(b.lastIndexed).getTime() -  new Date(a.lastIndexed).getTime();
    });

    return (
        <DataTable
            columns={columns}
            data={tableRepos}
            searchKey="name"
            searchPlaceholder="Search repositories..."
        />
    );
}