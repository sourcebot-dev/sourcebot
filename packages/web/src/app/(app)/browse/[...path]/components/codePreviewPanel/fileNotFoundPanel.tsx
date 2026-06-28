import { PathHeader } from "@/app/(app)/components/pathHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { getBrowsePath } from "../../../hooks/utils";
import type { CodeHostType } from "@sourcebot/db";

interface FileNotFoundPanelProps {
    path: string;
    repoName: string;
    revisionName?: string;
    repo: {
        codeHostType: CodeHostType;
        displayName?: string;
        externalWebUrl?: string;
    };
}

export const FileNotFoundPanel = ({ path, repoName, revisionName, repo }: FileNotFoundPanelProps) => {
    return (
        <>
            <div className="flex flex-row py-1 px-2 items-center justify-between">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repo.codeHostType,
                        displayName: repo.displayName,
                        externalWebUrl: repo.externalWebUrl,
                    }}
                    revisionName={revisionName}
                />
            </div>
            <Separator />
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <FileQuestion className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold">File not found</h2>
                    <p className="max-w-xl text-sm text-muted-foreground">
                        The path <span className="font-mono text-foreground">{path}</span> does not exist
                        {revisionName ? <> at <span className="font-mono text-foreground">{revisionName}</span></> : null}.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link
                        href={getBrowsePath({
                            repoName,
                            revisionName,
                            path: '',
                            pathType: 'tree',
                        })}
                    >
                        Return to repository root
                    </Link>
                </Button>
            </div>
        </>
    );
}
