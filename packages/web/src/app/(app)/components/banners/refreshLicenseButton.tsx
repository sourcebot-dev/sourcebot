'use client';

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import { refreshLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError, cn } from "@/lib/utils";

export function RefreshLicenseButton() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleClick = useCallback(() => {
        setIsRefreshing(true);
        refreshLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to refresh license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({ description: "License refreshed." });
                    router.refresh();
                }
            })
            .finally(() => {
                setIsRefreshing(false);
            });
    }, [router, toast]);

    return (
        <Button
            size="sm"
            variant="outline"
            onClick={handleClick}
            disabled={isRefreshing}
        >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            Refresh
        </Button>
    );
}
