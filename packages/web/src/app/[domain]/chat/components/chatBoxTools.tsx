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

export const ChatBoxTools = () => {
    const domain = useDomain();
    const { data: repos } = useQuery({
        queryKey: ["repos", domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
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
                options={repos?.map((repo) => ({
                    value: repo.repoName,
                    label: repo.repoName,
                })) ?? []}
                onValueChange={(value) => console.log(value)}
            />
        </>
    )
}
