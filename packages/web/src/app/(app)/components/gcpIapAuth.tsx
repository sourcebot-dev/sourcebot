'use client';

import { signIn } from "next-auth/react";
import { useEffect } from "react";

interface GcpIapAuthProps {
    callbackUrl?: string;
}

export const GcpIapAuth = ({ callbackUrl }: GcpIapAuthProps) => {
    useEffect(() => {
        signIn("gcp-iap", {
            redirectTo: callbackUrl ?? "/"
        }).catch((error) => {
            console.error("Error signing in with GCP IAP:", error);
        });
    }, [callbackUrl]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <p className="text-lg">Signing in with Google Cloud IAP...</p>
            </div>
        </div>
    );
}; 