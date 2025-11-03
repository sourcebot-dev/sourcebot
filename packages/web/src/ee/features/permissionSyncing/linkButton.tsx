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
            className="transition-all hover:bg-accent"
        >
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Connect
        </Button>
    );
};
