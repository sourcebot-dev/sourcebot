"use client";

import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons"
import { toast } from "@/components/hooks/use-toast";
import { flagConnectionForSync } from "@/actions";
import { isServiceError } from "@/lib/utils";
import useCaptureEvent from "@/hooks/useCaptureEvent";

interface RetrySyncButtonProps {
  connectionId: number;
  domain: string;
}

export const RetrySyncButton = ({ connectionId, domain }: RetrySyncButtonProps) => {
  const captureEvent = useCaptureEvent();

  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-2"
      onClick={async () => {
        const result = await flagConnectionForSync(connectionId, domain);
        if (isServiceError(result)) {
          toast({
            description: `❌ Failed to flag connection for sync.`,
          });
          captureEvent('wa_connection_retry_sync_fail', {
            error: result.errorCode,
          });
        } else {
          toast({
            description: "✅ Connection flagged for sync.",
          });
          captureEvent('wa_connection_retry_sync_success', {});
        }
      }}
    >
      <ReloadIcon className="h-4 w-4 mr-2" />
      Retry Sync
    </Button>
  );
};
