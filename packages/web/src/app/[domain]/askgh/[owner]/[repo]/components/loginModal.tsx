'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AuthMethodSelector } from "@/app/components/authMethodSelector";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";

interface LoginModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    providers: IdentityProviderMetadata[];
    callbackUrl: string;
}

export const LoginModal = ({
    isOpen,
    onOpenChange,
    providers,
    callbackUrl,
}: LoginModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="mb-3">Sign up to continue</DialogTitle>
                    <DialogDescription>
                        Sign into your account to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <AuthMethodSelector
                        providers={providers}
                        callbackUrl={callbackUrl}
                        context="login"
                        securityNoticeClosable={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
