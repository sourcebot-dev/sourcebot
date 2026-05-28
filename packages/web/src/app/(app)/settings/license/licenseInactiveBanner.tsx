"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RemoveActivationCodeDialog } from "./removeActivationCodeDialog";

export function LicenseInactiveBanner() {
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    return (
        <>
            <div className="flex items-center justify-between gap-3 border-t bg-destructive px-4 py-2.5 text-gray-50">
                <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <p className="text-sm">
                        <span className="font-medium">License is not active.</span>{" "}
                        <span className="text-gray-50/90">Paid features are disabled for this deployment.</span>
                    </p>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsRemoveDialogOpen(true)}
                    className="border-gray-50/40 bg-transparent text-gray-50 hover:bg-white/10 hover:text-gray-50 flex-shrink-0"
                >
                    Remove activation code
                </Button>
            </div>
            <RemoveActivationCodeDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen} />
        </>
    );
}
