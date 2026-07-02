'use client';

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getFileSource, getFiles, listRepos } from "@/app/api/(client)/client";
import { parseAgentSkillMarkdown, type ParsedAgentSkillMarkdown } from "@/ee/features/chat/skills/types";
import type { RepositoryQuery } from "@/lib/types";
import { unwrapServiceError } from "@/lib/utils";

const MAX_RESULTS = 100;
const MARKDOWN_FILE_REGEX = /\.(md|markdown)$/i;

// A markdown file imported from a repository, carrying the provenance needed to
// create a read-only skill that stays synced with its source.
export interface ImportedRepoSkill {
    parsed: ParsedAgentSkillMarkdown;
    source: {
        repoName: string;
        filePath: string;
        revision: string;
        blobSha: string;
    };
}

interface ImportFromRepoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Called once a markdown file has been fetched, with the parsed skill and the
    // source provenance. The parent creates the synced skill and surfaces the result.
    onImport: (imported: ImportedRepoSkill) => void;
    onError: (message: string) => void;
}

export const ImportFromRepoDialog = ({ open, onOpenChange, onImport, onError }: ImportFromRepoDialogProps) => {
    const [selectedRepo, setSelectedRepo] = useState<RepositoryQuery | null>(null);
    const [repoQuery, setRepoQuery] = useState("");
    const [fileQuery, setFileQuery] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    const revisionName = selectedRepo?.defaultBranch ?? "HEAD";

    const { data: repos = [], isLoading: isLoadingRepos, isError: isReposError } = useQuery({
        queryKey: ["skillImportRepos", repoQuery],
        queryFn: () => unwrapServiceError(listRepos({
            page: 1,
            perPage: MAX_RESULTS,
            sort: "name",
            direction: "asc",
            query: repoQuery,
        })),
        enabled: open && selectedRepo === null,
        // Keep the previous results visible while a new query streams in, so the
        // CommandList stays mounted on every keystroke (cmdk crashes if its list
        // ref is unmounted mid-search).
        placeholderData: keepPreviousData,
    });

    const { data: files = [], isLoading: isLoadingFiles, isError: isFilesError } = useQuery({
        queryKey: ["skillImportFiles", selectedRepo?.repoName, revisionName],
        queryFn: () => unwrapServiceError(getFiles({ repoName: selectedRepo!.repoName, revisionName })),
        enabled: open && selectedRepo !== null,
    });

    const markdownFiles = useMemo(() => {
        const query = fileQuery.trim().toLowerCase();
        return files
            .filter((file) => MARKDOWN_FILE_REGEX.test(file.path))
            .filter((file) => (query ? file.path.toLowerCase().includes(query) : true))
            .slice(0, MAX_RESULTS);
    }, [files, fileQuery]);

    // Radix locks `<body>` with `pointer-events: none` while a modal is open, and
    // when a dialog is opened from a menu it can fail to release that lock on close,
    // which freezes the whole page. Make sure the lock is cleared whenever this
    // dialog is not open and on unmount.
    useEffect(() => {
        if (!open) {
            document.body.style.pointerEvents = "";
        }
        return () => {
            document.body.style.pointerEvents = "";
        };
    }, [open]);

    const resetAndClose = () => {
        setSelectedRepo(null);
        setRepoQuery("");
        setFileQuery("");
        onOpenChange(false);
    };

    const handleSelectRepo = (repo: RepositoryQuery) => {
        setSelectedRepo(repo);
        setFileQuery("");
    };

    const handleBackToRepos = () => {
        setSelectedRepo(null);
        setFileQuery("");
    };

    const handleSelectFile = async (path: string, name: string) => {
        if (!selectedRepo || isImporting) {
            return;
        }
        setIsImporting(true);
        try {
            const result = await unwrapServiceError(getFileSource({
                path,
                repo: selectedRepo.repoName,
                ref: revisionName,
            }));
            if (!result.blobSha) {
                // Without the blob OID we can't track the file for syncing; don't
                // create a half-linked skill. Leave the dialog open to retry.
                onError("Couldn't determine the file version to sync. Please try again.");
                return;
            }
            onImport({
                parsed: parseAgentSkillMarkdown(result.source, name),
                source: {
                    repoName: selectedRepo.repoName,
                    filePath: path,
                    revision: revisionName,
                    blobSha: result.blobSha,
                },
            });
            resetAndClose();
        } catch {
            onError("Failed to load the selected file.");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetAndClose(); } }} modal={true}>
            <DialogContent className="overflow-hidden p-0 shadow-lg max-w-[90vw] sm:max-w-2xl top-[20%] translate-y-0">
                <DialogTitle className="sr-only">Import a skill from a repository</DialogTitle>
                <DialogDescription className="sr-only">
                    Browse your indexed repositories and import a markdown file as a skill.
                </DialogDescription>

                {selectedRepo === null ? (
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Search your indexed repositories..."
                            onValueChange={setRepoQuery}
                        />
                        <CommandList>
                            {isLoadingRepos ? (
                                <ResultsSkeleton />
                            ) : isReposError ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Error loading repositories.</p>
                            ) : (
                                <>
                                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        No repositories found.
                                    </CommandEmpty>
                                    <CommandGroup heading="Repositories">
                                        {repos.map((repo) => (
                                            <CommandItem
                                                key={repo.repoId}
                                                value={repo.repoName}
                                                onSelect={() => handleSelectRepo(repo)}
                                                className="cursor-pointer"
                                            >
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-medium">
                                                        {repo.repoDisplayName ?? repo.repoName}
                                                    </span>
                                                    {repo.repoDisplayName && (
                                                        <span className="truncate text-xs text-muted-foreground">{repo.repoName}</span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    </Command>
                ) : (
                    <Command shouldFilter={false}>
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                            <button
                                type="button"
                                onClick={handleBackToRepos}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <ArrowLeftIcon className="h-3.5 w-3.5" />
                                Repositories
                            </button>
                            <span className="truncate text-xs font-medium text-foreground">
                                {selectedRepo.repoDisplayName ?? selectedRepo.repoName}
                            </span>
                        </div>
                        <CommandInput
                            placeholder="Search markdown files..."
                            onValueChange={setFileQuery}
                            disabled={isLoadingFiles}
                        />
                        <CommandList>
                            {isLoadingFiles ? (
                                <ResultsSkeleton />
                            ) : isFilesError ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Error loading files.</p>
                            ) : (
                                <>
                                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                        No markdown files found.
                                    </CommandEmpty>
                                    <CommandGroup heading="Markdown files">
                                        {markdownFiles.map((file) => (
                                            <CommandItem
                                                key={file.path}
                                                value={file.path}
                                                onSelect={() => void handleSelectFile(file.path, file.name)}
                                                disabled={isImporting}
                                                className="cursor-pointer"
                                            >
                                                <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-medium">{file.name}</span>
                                                    <span className="truncate text-xs text-muted-foreground">{file.path}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                        {isImporting && (
                            <div className="flex items-center justify-center gap-2 border-t py-3 text-sm text-muted-foreground">
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                                Importing...
                            </div>
                        )}
                    </Command>
                )}
            </DialogContent>
        </Dialog>
    );
};

const ResultsSkeleton = () => {
    return (
        <div className="p-2">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="mb-1 flex flex-row gap-2 p-2">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex w-full flex-col gap-1">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))}
        </div>
    );
};
