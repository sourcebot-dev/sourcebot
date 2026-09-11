'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import { usePathname, useSearchParams } from "next/navigation";

interface LoginDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const LoginDialog = ({
    isOpen,
    onOpenChange,
}: LoginDialogProps) => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const callbackUrl = `${pathname}?${searchParams.toString()}`;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="mb-3">Sign in to continue</DialogTitle>
                    <DialogDescription>
                        Sign into your account to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <AuthMethodSelector
                        context="login"
                        callbackUrl={callbackUrl}
                        hideSecurityNotice={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
