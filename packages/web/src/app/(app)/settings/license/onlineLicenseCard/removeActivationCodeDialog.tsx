"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { deactivateLicense } from "@/ee/features/lighthouse/actions";
import { isServiceError } from "@/lib/utils";

interface RemoveActivationCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RemoveActivationCodeDialog({ open, onOpenChange }: RemoveActivationCodeDialogProps) {
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

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
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
    );
}
