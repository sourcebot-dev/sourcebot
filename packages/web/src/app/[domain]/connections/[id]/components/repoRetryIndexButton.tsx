"use client";

import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons"
import { toast } from "@/components/hooks/use-toast";
import { flagRepoForIndex } from "@/actions";
import { isServiceError } from "@/lib/utils";

interface RetryRepoIndexButtonProps {
  repoId: number;
  domain: string;
}

export const RetryRepoIndexButton = ({ repoId, domain }: RetryRepoIndexButtonProps) => {
  return (
    <Button
      variant="outline" 
      size="sm"
      className="ml-2"
      onClick={async () => {
        const result = await flagRepoForIndex(repoId, domain);
        if (isServiceError(result)) {
          toast({
            description: `❌ Failed to flag repository for indexing.`,
          });
        } else {
          toast({
            description: "✅ Repository flagged for indexing.",
          });
        }
      }}
    >
      <ReloadIcon className="h-4 w-4 mr-2" />
      Retry Index
    </Button>
  );
};
