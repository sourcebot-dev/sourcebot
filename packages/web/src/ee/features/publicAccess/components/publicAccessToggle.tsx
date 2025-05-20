"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OrgRole } from "@sourcebot/db";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { getPublicAccessStatus, flipPublicAccessStatus } from "@/ee/features/publicAccess/publicAccess";
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
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface PublicAccessToggleProps {
    currentUserRole: OrgRole;
    domain: string;
}

export function PublicAccessToggle({ currentUserRole, domain }: PublicAccessToggleProps) {
    const [isPublicAccessEnabled, setIsPublicAccessEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchStatus() {
            try {
                const status = await getPublicAccessStatus(domain);
                if (isServiceError(status)) {
                    throw new ServiceErrorException(status);
                }
                setIsPublicAccessEnabled(status);
            } catch (error) {
                console.error("Failed to fetch public access status:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchStatus();
    }, [domain]);

    const handleToggle = async () => {
        setIsLoading(true);
        try {
            /*
            const result = await flipPublicAccessStatus(domain);
            if (isServiceError(result)) {
                throw new ServiceErrorException(result);
            }
            */
            setIsPublicAccessEnabled(!isPublicAccessEnabled);
        } catch (error) {
            console.error("Failed to update public access status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Switch
                            id="public-access"
                            checked={isPublicAccessEnabled}
                            disabled={currentUserRole !== OrgRole.OWNER || isLoading}
                            title={currentUserRole !== OrgRole.OWNER ? "Only organization owners can change public access settings" : undefined}
                            className={isLoading ? "opacity-80" : ""}
                        />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Public Access Change</AlertDialogTitle>
                            <AlertDialogDescription>
                                {isPublicAccessEnabled 
                                    ? "Are you sure you want to disable public access? This will prevent unauthenticated users from viewing your organization's Sourcebot deployment."
                                    : "Are you sure you want to enable public access? This will allow unauthenticated users to view your organization's Sourcebot deployment."}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleToggle} disabled={isLoading}>
                                {isLoading ? "Updating..." : "Confirm"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                {isLoading && (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                )}
            </div>
            <div className="space-y-1">
                <Label htmlFor="public-access">Public Access</Label>
                <p className="text-sm text-muted-foreground">
                    Enabling public access allows unauthenticated users to view your organization&apos;s Sourcebot deployment.
                </p>
            </div>
        </div>
    );
}
