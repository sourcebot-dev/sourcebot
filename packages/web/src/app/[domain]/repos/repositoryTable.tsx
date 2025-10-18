"use client";

import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PlusIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { columns, RepositoryColumnInfo, RepoStatus } from "./columns";
import { AddRepositoryDialog } from "./components/addRepositoryDialog";

interface RepositoryTableProps {
    repos: {
        repoId: number;
        repoName: string;
        repoDisplayName: string;
        imageUrl?: string;
        indexedAt?: Date;
        status: RepoStatus;
    }[];
    domain: string;
    isAddReposButtonVisible: boolean;
}

export const RepositoryTable = ({
    repos,
    domain,
    isAddReposButtonVisible,
}: RepositoryTableProps) => {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const tableRepos = useMemo(() => {
        return repos.map((repo): RepositoryColumnInfo => ({
            repoId: repo.repoId,
            repoName: repo.repoName,
            repoDisplayName: repo.repoDisplayName ?? repo.repoName,
            imageUrl: repo.imageUrl,
            status: repo.status,
            lastIndexed: repo.indexedAt?.toISOString() ?? "",
        })).sort((a, b) => {
            const getPriorityFromStatus = (status: RepoStatus) => {
                switch (status) {
                    case 'syncing':
                        return 0  // Highest priority - currently syncing
                    case 'not-indexed':
                        return 1  // Second priority - not yet indexed
                    case 'indexed':
                        return 2  // Third priority - successfully indexed
                    default:
                        return 3
                }
            }

            // Sort by priority first
            const aPriority = getPriorityFromStatus(a.status);
            const bPriority = getPriorityFromStatus(b.status);

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            // If same priority, sort by last indexed date (most recent first)
            if (a.lastIndexed && b.lastIndexed) {
                return new Date(b.lastIndexed).getTime() - new Date(a.lastIndexed).getTime();
            }

            // Put items without dates at the end
            if (!a.lastIndexed) return 1;
            if (!b.lastIndexed) return -1;
            return 0;
        });
    }, [repos]);

    const tableColumns = useMemo(() => {
        return columns(domain);
    }, [domain]);

    return (
        <>
            <DataTable
                columns={tableColumns}
                data={tableRepos}
                searchKey="repoDisplayName"
                searchPlaceholder="Search repositories..."
                headerActions={(
                    <div className="flex items-center justify-between w-full gap-2">
                        <Button
                            variant="outline"
                            size="default"
                            className="ml-2"
                            onClick={() => {
                                router.refresh();
                                toast({
                                    description: "Page refreshed",
                                });
                            }}>
                            <RefreshCwIcon className="w-4 h-4" />
                            Refresh
                        </Button>
                        {isAddReposButtonVisible && (
                            <Button
                                variant="default"
                                size="default"
                                onClick={() => setIsAddDialogOpen(true)}
                            >
                                <PlusIcon className="w-4 h-4" />
                                Add repository
                            </Button>
                        )}
                    </div>
                )}
            />

            <AddRepositoryDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />
        </>
    );
}