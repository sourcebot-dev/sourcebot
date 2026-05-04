'use client';

import { CopyIconButton } from "@/app/(app)/components/copyIconButton";
import { useToast } from "@/components/hooks/use-toast";
import Link from "next/link";
import { Fragment, useCallback } from "react";
import { getBrowsePath } from "../../../hooks/utils";

interface CommitHashLineProps {
    repoName: string;
    commitHash: string;
    parents: string[];
}

export const CommitHashLine = ({ repoName, commitHash, parents }: CommitHashLineProps) => {
    const { toast } = useToast();

    const onCopyHash = useCallback(() => {
        navigator.clipboard.writeText(commitHash).then(() => {
            toast({ description: "✅ Copied commit SHA to clipboard" });
        });
        return true;
    }, [commitHash, toast]);

    return (
        <div className="text-xs font-mono text-muted-foreground flex flex-row items-center gap-1">
            {parents.length > 0 && (
                <>
                    <span>
                        {parents.length} parent{parents.length > 1 ? 's' : ''}
                    </span>
                    {parents.map((parent, i) => (
                        <Fragment key={parent}>
                            {i > 0 && <span>+</span>}
                            <Link
                                href={getBrowsePath({
                                    repoName,
                                    path: '',
                                    pathType: 'commit',
                                    commitSha: parent,
                                })}
                                className="underline hover:text-foreground"
                                title={parent}
                            >
                                {parent.slice(0, 7)}
                            </Link>
                        </Fragment>
                    ))}
                </>
            )}
            <span>commit {commitHash.slice(0, 7)}</span>
            <CopyIconButton onCopy={onCopyHash} />
        </div>
    );
};
