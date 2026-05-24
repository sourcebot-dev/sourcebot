'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import { usePathname } from "next/navigation";

interface LoginDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const LoginDialog = ({
    isOpen,
    onOpenChange,
}: LoginDialogProps) => {
    const pathname = usePathname();

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
                        callbackUrl={pathname}
                        hideSecurityNotice={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
