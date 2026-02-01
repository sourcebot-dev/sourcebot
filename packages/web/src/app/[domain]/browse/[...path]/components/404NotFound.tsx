'use client';

import { $Enums } from "@sourcebot/db";
import { ServiceError } from "@/lib/serviceError";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import { useEffect } from "react";
import { FileSourceResponse } from "@/features/git/getFileSourceApi";
import { PathHeader } from "@/app/[domain]/components/pathHeader";

type RepoInfoResponse = ServiceError | {
    id: number;
    name: string;
    displayName: string | undefined;
    codeHostType: $Enums.CodeHostType;
    externalWebUrl: string | undefined;
    imageUrl: string | undefined;
    indexedAt: Date | undefined;
}

type FileSourceResponseType = FileSourceResponse | ServiceError;

export const FileNotFound = ({
    repoInfoResponse,
    fileSourceResponse,
    revisionName,
    path,
    repoName
}: {
    repoInfoResponse: RepoInfoResponse;
    fileSourceResponse: FileSourceResponseType;
    revisionName?: string;
    path: string;
    repoName: string;
}) => {
    // Get display name from repoInfoResponse if available, otherwise use repoName
    const displayRepoName = !('statusCode' in repoInfoResponse) 
        ? (repoInfoResponse.displayName || repoInfoResponse.name.split('/').pop() || repoName)
        : repoName;
    
    // Use revisionName if provided, otherwise default to HEAD
    const branchName = revisionName || 'HEAD';
    const filePath = path;

    // Check if repoInfoResponse is a ServiceError
    const isRepoInfoError = 'statusCode' in repoInfoResponse;
    const repoInfo = isRepoInfoError ? null : repoInfoResponse;
    
    return <>
    <div
    className="p-8">
        {/* display path header */}
        {repoInfo && (
            <div
            className="mb-6">
                <PathHeader
                    path={path}
                    repo={{
                        name: repoName,
                        codeHostType: repoInfo.codeHostType,
                        displayName: repoInfo.displayName,
                        externalWebUrl: repoInfo.externalWebUrl,
                    }}
                    revisionName={revisionName}
                />
            </div>
        )}
        <div 
        className="flex flex-col items-center justify-center min-h-[60vh] px-4 border-2 border-border rounded-lg"
        >
            {/* icon */}
            <div className="mb-6">
                <TriangleAlert 
                    className="w-12 h-12 text-muted-foreground" 
                />
            </div>

            {/* error message with status code */}
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-foreground">
                    404 - page not found
                </h1>
            </div>

            {/* detailed error with path */}
            <div className="mb-8 max-w-2xl text-center">
                <p className="text-muted-foreground">
                    The <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-sm">{branchName}</span> branch of <span className="font-medium text-foreground">{displayRepoName}</span> does not contain the path <span className="font-mono text-sm">{filePath}</span>.
                </p>
            </div>

            {/* return to overview button */}
            <div>
                <Button 
                    asChild
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-green-600 dark:hover:bg-green-700 text-white"
                >
                    <Link
                        href={getBrowsePath({
                            repoName: !('statusCode' in repoInfoResponse) ? repoInfoResponse.name : repoName,
                            path: '/',
                            pathType: 'tree',
                            domain: SINGLE_TENANT_ORG_DOMAIN,
                        })}
                    >
                        Return to the repository overview
                    </Link>
                </Button>
            </div>
        </div>
        </div>
    </>
}

