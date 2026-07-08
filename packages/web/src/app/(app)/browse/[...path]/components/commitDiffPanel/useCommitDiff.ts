'use client';

import { getCommit, getDiff } from "@/app/api/(client)/client";
import { isServiceError } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// Git's well-known empty-tree SHA. Used as the diff base when the commit has
// no parent (i.e. the initial commit), since `<sha>^` doesn't resolve there.
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

interface UseCommitDiffProps {
    repoName: string;
    commitSha: string;
    // When set, restricts the diff to changes touching this file path.
    path?: string;
}

export const useCommitDiff = ({ repoName, commitSha, path }: UseCommitDiffProps) => {
    return useQuery({
        queryKey: ['commitDiff', repoName, commitSha, path ?? null],
        queryFn: async () => {
            const [commitResponse, initialDiffResponse] = await Promise.all([
                getCommit({
                    repo: repoName,
                    ref: commitSha,
                }),
                getDiff({
                    repo: repoName,
                    base: `${commitSha}^`,
                    head: commitSha,
                    path,
                }),
            ]);

            if (isServiceError(commitResponse)) {
                throw new Error(`Error loading commit: ${commitResponse.message}`);
            }

            // Initial commit has no parent — `<sha>^` fails. Fall back to diffing
            // against git's empty tree so all files show as added.
            let diffResponse = initialDiffResponse;
            if (isServiceError(initialDiffResponse) && commitResponse.parents.length === 0) {
                diffResponse = await getDiff({
                    repo: repoName,
                    base: EMPTY_TREE_SHA,
                    head: commitSha,
                    path,
                });
            }

            if (isServiceError(diffResponse)) {
                throw new Error(`Error loading diff: ${diffResponse.message}`);
            }

            return {
                commit: commitResponse,
                diff: diffResponse,
            };
        },
    });
};
