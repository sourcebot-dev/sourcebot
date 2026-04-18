"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/hooks/use-toast";
import { refreshLicense, createPortalSession, deactivateLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError, cn } from "@/lib/utils";

export function PlanActionsMenu() {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isOpeningPortal, setIsOpeningPortal] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleRemove = useCallback(() => {
        deactivateLicense()
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to remove activation code: ${response.message}`,
                        variant: "destructive",
                    });
                } else {
                    toast({
                        description: "Activation code removed successfully.",
                    });
                    router.refresh();
                }
            });
    }, [router, toast]);

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
        <>
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
                        Refresh subscription
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setIsRemoveDialogOpen(true)}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove activation code
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove activation code</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove this activation code? Your deployment will no longer have a registered license.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleRemove}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
