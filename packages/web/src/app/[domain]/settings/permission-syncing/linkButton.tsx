'use client';

import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { signIn } from "next-auth/react";

interface LinkButtonProps {
    provider: string;
    providerName: string;
    callbackUrl: string;
}

export const LinkButton = ({ provider, providerName, callbackUrl }: LinkButtonProps) => {
    const handleLink = () => {
        signIn(provider, {
            redirectTo: callbackUrl
        });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleLink}
        >
            <Link2 className="h-4 w-4 mr-1" />
            Link
        </Button>
    );
};
