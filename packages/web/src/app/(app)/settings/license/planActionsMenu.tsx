"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/hooks/use-toast";
import { refreshLicense, createPortalSession } from "@/ee/features/lighthouse/actions";
import { isServiceError, cn } from "@/lib/utils";

export function PlanActionsMenu() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        refreshLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to refresh license: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: "License refreshed successfully.",
                    });
                    router.refresh();
                }
            })
            .finally(() => {
                setIsRefreshing(false);
            });
    }, [router, toast]);

    const handleManage = useCallback(() => {
        setIsOpeningPortal(true);
        const returnUrl = `${window.location.origin}/settings/license`;
        createPortalSession(returnUrl)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to open subscription portal: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsOpeningPortal(false);
                } else {
                    router.push(response.url);
                }
            });
    }, [router, toast]);

    const isBusy = isRefreshing || isOpeningPortal;

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    disabled={isBusy}
                    aria-label="Plan actions"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={handleManage}
                    disabled={isOpeningPortal}
                >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage subscription
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault();
                        handleRefresh();
                    }}
                    disabled={isRefreshing}
                >
                    <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                    Refresh license
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
