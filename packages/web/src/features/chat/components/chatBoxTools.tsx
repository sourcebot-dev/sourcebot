'use client';

import { getRepos } from "@/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { AtSignIcon } from "lucide-react";
import { ReactEditor, useSlate } from "slate-react";
import { RepoSelector } from "./repoSelector";
import { RepoIndexingStatus } from "@sourcebot/db";

interface ChatBoxToolsProps {
    selectedRepos: string[];
    onSelectedReposChange: (repos: string[]) => void;
}

export const ChatBoxTools = ({
    selectedRepos,
    onSelectedReposChange,
}: ChatBoxToolsProps) => {
    const domain = useDomain();
    const { data: repos } = useQuery({
        queryKey: ["repos", domain],
        queryFn: () => unwrapServiceError(getRepos(domain, {
            status: [RepoIndexingStatus.INDEXED]
        })),
    });

    const editor = useSlate();

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-muted-foreground hover:text-primary"
                onClick={() => {
                    editor.insertText("@");
                    ReactEditor.focus(editor);
                }}
            >
                <AtSignIcon className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <RepoSelector
                className="bg-inherit w-fit h-6 min-h-6"
                values={repos?.map((repo) => repo.repoName) ?? []}
                selectedValues={selectedRepos}
                onValueChange={onSelectedReposChange}
            />
        </>
    )
}
