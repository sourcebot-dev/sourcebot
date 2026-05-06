'use client';

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { dismissBanner } from "./actions";
import type { BannerId } from "./types";

interface BannerShellProps {
    id: BannerId;
    dismissible: boolean;
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
}

export function BannerShell({ id, dismissible, icon, title, description, action }: BannerShellProps) {
    const [isDismissed, setIsDismissed] = useState(false);

    if (isDismissed) {
        return null;
    }

    const handleDismiss = async () => {
        setIsDismissed(true);
        await dismissBanner(id);
    };

    return (
        <Alert className="rounded-none border-x-0 border-t-0 bg-accent">
            {icon}
            <AlertTitle>{title}</AlertTitle>
            {description && <AlertDescription>{description}</AlertDescription>}
            {(action || dismissible) && (
                <AlertAction className="flex items-center gap-2">
                    {action}
                    {dismissible && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={handleDismiss}
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </AlertAction>
            )}
        </Alert>
    );
}
