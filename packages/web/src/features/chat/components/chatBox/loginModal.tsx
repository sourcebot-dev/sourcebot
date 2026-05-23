'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import { useIdentityProviders } from "@/features/auth/useIdentityProviders";
import { usePathname } from "next/navigation";

interface LoginModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const LoginModal = ({
    isOpen,
    onOpenChange,
}: LoginModalProps) => {
    const providers = useIdentityProviders();
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
                        providers={providers}
                        context="login"
                        callbackUrl={pathname}
                        hideSecurityNotice={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
