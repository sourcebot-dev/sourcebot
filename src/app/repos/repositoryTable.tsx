'use client';

import { DataTable } from "@/components/ui/data-table";
import { columns, RepositoryColumnInfo } from "./columns";
import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getRepos } from "../api/(client)/client";

export const RepositoryTable = () => {
    const { data: _repos } = useQuery({
        queryKey: ["repos"],
        queryFn: () => getRepos(),
        enabled: typeof window !== "undefined",
    });

    const repos = useMemo(() => {
        if (isServiceError(_repos)) {
            return [];
        }

        return _repos?.List.Repos.map((repo): RepositoryColumnInfo => ({
            name: repo.Repository.Name,
            branches: repo.Repository.Branches.map((branch) => {
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
        })).sort((a, b) => {
            return new Date(b.lastIndexed).getTime() - new Date(a.lastIndexed).getTime();
        }) ?? [];
    }, [_repos]);

    return (
        <DataTable
            columns={columns}
            data={repos}
            searchKey="name"
            searchPlaceholder="Search repositories..."
        />
    );
}