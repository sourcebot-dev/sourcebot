"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RemoveActivationCodeDialog } from "./removeActivationCodeDialog";

export function LicenseInactiveBanner() {
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    return (
        <>
            <div className="flex items-start justify-between gap-3 border-t bg-destructive p-4 text-gray-50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-0.5">
                        <p className="font-medium leading-none">License is not active</p>
                        <p className="text-sm">Paid features are disabled for this deployment.</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsRemoveDialogOpen(true)}
                    className="border-gray-50/40 bg-transparent text-gray-50 hover:bg-white/10 hover:text-gray-50"
                >
                    Remove activation code
                </Button>
            </div>
            <RemoveActivationCodeDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen} />
        </>
    );
}
