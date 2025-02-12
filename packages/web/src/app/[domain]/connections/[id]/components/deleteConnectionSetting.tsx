'use client';

import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";
import { deleteConnection } from "@/actions";
import { Loader2 } from "lucide-react";
import { isServiceError } from "@/lib/utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useDomain } from "@/hooks/useDomain";

interface DeleteConnectionSettingProps {
    connectionId: number;
}

export const DeleteConnectionSetting = ({
    connectionId,
}: DeleteConnectionSettingProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const domain = useDomain();
    const { toast } = useToast();
    const router = useRouter();

    const handleDelete = useCallback(() => {
        setIsDialogOpen(false);
        setIsLoading(true);
        deleteConnection(connectionId, domain)
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `❌ Failed to delete connection. Reason: ${response.message}`
                    });
                } else {
                    toast({
                        description: `✅ Connection deleted successfully.`
                    });
                    router.replace(`/${domain}/connections`);
                    router.refresh();
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [connectionId, domain, router, toast]);

    return (
        <div className="flex flex-col w-full bg-background border rounded-lg p-6">
            <h2 className="text-lg font-semibold">Delete Connection</h2>
            <p className="text-sm text-muted-foreground mt-2">
                Permanently delete this connection from Sourcebot. All linked repositories that are not linked to any other connection will also be deleted.
            </p>
            <div className="flex flex-row justify-end">
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="destructive"
                            className="mt-4"
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="animate-spin mr-2" />}
                            Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Yes, delete connection</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}