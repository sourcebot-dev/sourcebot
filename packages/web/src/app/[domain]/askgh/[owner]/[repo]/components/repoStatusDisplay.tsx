'use client';

import { ServiceError } from "@/lib/serviceError";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { RepoInfo } from "../types";
import { SearchBar } from "@/app/[domain]/components/searchBar";
import { SyntaxGuideProvider } from "@/app/[domain]/components/syntaxGuideProvider";

const REINDEX_INTERVAL_MS = 2000;

interface Props {
    initialRepoInfo: RepoInfo;
}

export function RepoStatusDisplay({ initialRepoInfo }: Props) {
    const { data: repoInfo, isError } = useQuery({
        queryKey: ['repo-status', initialRepoInfo.id],
        queryFn: () => unwrapServiceError(getRepoStatus(initialRepoInfo.id)),
        initialData: initialRepoInfo,
        refetchInterval: (query) => {
            const repo = query.state.data;

            // If repo has been indexed before (indexedAt is not null), stop polling
            if (repo?.isIndexed) {
                return false;
            }

            return REINDEX_INTERVAL_MS;
        },
    });

    if (isError) {
        // todo
        return null;
    }

    if (!repoInfo.isIndexed) {
        // Loading spinner only for first-time indexing (indexedAt is null)
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <h2 className="text-2xl font-semibold mb-2">
                    Indexing in progress...
                </h2>
                <p className="text-muted-foreground text-center">
                    This may take a few minutes. The page will update automatically.
                </p>
            </div>
        );
    }

    return (
        <div>
            <pre className="p-4">
                {JSON.stringify({
                    status: 'indexed',
                    repo: {
                        id: repoInfo.id,
                        name: repoInfo.name,
                        displayName: repoInfo.displayName,
                    }
                }, null, 2)}
            </pre>
            <SyntaxGuideProvider>
                <SearchBar
                    size="sm"
                    defaults={{
                        query: `repo:^${repoInfo.name}$`,
                    }}
                    autoFocus
                />
            </SyntaxGuideProvider>
        </div>
    );
}

const getRepoStatus = async (repoId: number): Promise<RepoInfo | ServiceError> => {
    const result = await fetch(
        `/api/repo-status/${repoId}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }
    ).then(response => response.json());
    return result as RepoInfo | ServiceError;
}