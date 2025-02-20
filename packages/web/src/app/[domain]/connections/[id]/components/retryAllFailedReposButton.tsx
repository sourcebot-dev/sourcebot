"use client";

import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons"
import { toast } from "@/components/hooks/use-toast";
import { flagRepoForIndex, getConnectionFailedRepos } from "@/actions";
import { isServiceError } from "@/lib/utils";

interface RetryAllFailedReposButtonProps {
  connectionId: number;
  domain: string;
}

export const RetryAllFailedReposButton = ({ connectionId, domain }: RetryAllFailedReposButtonProps) => {
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-2"
      onClick={async () => {
        const failedRepos = await getConnectionFailedRepos(connectionId, domain);
        if (isServiceError(failedRepos)) {
          toast({
            description: `❌ Failed to get failed repositories.`,
          });
          return;
        }

        let successCount = 0;
        let failureCount = 0;

        for (const repo of failedRepos) {
          const result = await flagRepoForIndex(repo.repoId, domain);
          if (isServiceError(result)) {
            failureCount++;
          } else {
            successCount++;
          }
        }

        if (failureCount > 0) {
          toast({
            description: `⚠️ ${successCount} repositories flagged for indexing, ${failureCount} failed.`,
          });
        } else if (successCount > 0) {
          toast({
            description: `✅ ${successCount} repositories flagged for indexing.`,
          });
        } else {
          toast({
            description: "ℹ️ No failed repositories to retry.",
          });
        }
      }}
    >
      <ReloadIcon className="h-4 w-4 mr-2" />
      Retry All Failed
    </Button>
  );
};
