'use client';

import { useToast } from "@/components/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDomain } from "@/hooks/useDomain";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { RepositoryQuery } from "@/lib/types";
import { getCodeHostInfoForRepo, getShortenedNumberDisplayString } from "@/lib/utils";
import clsx from "clsx";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

interface ProgressIndicatorProps {
    numberOfReposWithFirstTimeIndexingJobsInProgress: number;
    sampleRepos: RepositoryQuery[];
}

export const ProgressIndicator = ({
    numberOfReposWithFirstTimeIndexingJobsInProgress: numRepos,
    sampleRepos,
}: ProgressIndicatorProps) => {
    const domain = useDomain();
    const router = useRouter();
    const { toast } = useToast();

    if (numRepos === 0) {
        return null;
    }

    const numReposString = getShortenedNumberDisplayString(numRepos);

    return (
        <Tooltip>
            <TooltipTrigger>
                <Link href={`/${domain}/repos`}>
                    <Badge variant="outline" className="flex flex-row items-center gap-2 h-8">
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                        <span>{numReposString}</span>
                    </Badge>
                </Link>
            </TooltipTrigger>
            <TooltipContent className="p-4 w-72">
                <div className="flex flex-row gap-1 items-center">
                    <p className="text-md font-medium">{`Syncing ${numReposString} ${numRepos === 1 ? 'repository' : 'repositories'}`}</p>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground"
                        onClick={() => {
                            router.refresh();
                            toast({
                                description: "Page refreshed",
                            });
                        }}
                    >
                        <RefreshCwIcon className="w-3 h-3" />
                    </Button>
                </div>
                <Separator className="my-3" />
                <div className="flex flex-col gap-2">
                    {sampleRepos.map((repo) => (
                        <RepoItem key={repo.repoId} repo={repo} />
                    ))}
                </div>
                {numRepos > sampleRepos.length && (
                    <div className="mt-2">
                        <Link href={`/${domain}/repos`} className="text-sm text-link hover:underline">
                            {`View ${numRepos - sampleRepos.length} more`}
                        </Link>
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    )
}

const RepoItem = ({ repo }: { repo: RepositoryQuery }) => {

    const { repoIcon, displayName } = useMemo(() => {
        const info = getCodeHostInfoForRepo({
            name: repo.repoName,
            codeHostType: repo.codeHostType,
            displayName: repo.repoDisplayName,
            externalWebUrl: repo.externalWebUrl,
        });

        return {
            repoIcon: <Image
                src={info.icon}
                alt={info.codeHostName}
                className={`w-4 h-4 ${info.iconClassName}`}
            />,
            displayName: info.displayName,
        }
    }, [repo.repoName, repo.codeHostType, repo.repoDisplayName, repo.externalWebUrl]);


    return (
        <Link
            className={clsx("flex flex-row items-center gap-2 border rounded-md p-2 text-clip")}
            href={`/${SINGLE_TENANT_ORG_DOMAIN}/repos/${repo.repoId}`}
        >
            {repoIcon}
            <span className="text-sm truncate">
                {displayName}
            </span>
        </Link>
    )
}