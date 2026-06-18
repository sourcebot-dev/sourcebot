'use client';

import { useCallback, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { isServiceError } from "@/lib/utils";
import { getServicePingHistory } from "./actions";

export function DownloadServicePingHistoryButton() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleDownload = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getServicePingHistory();

            if (isServiceError(result)) {
                toast({
                    description: "Failed to export service ping history. Please try again.",
                    variant: "destructive",
                });
                return;
            }

            if (result.length === 0) {
                toast({
                    description: "No service ping history has been recorded yet.",
                });
                return;
            }

            const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${new Date().toISOString().slice(0, 10)}-usage-history.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isLoading}
        >
            {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Download className="h-3.5 w-3.5" />
            )}
            Download usage report
        </Button>
    );
}
