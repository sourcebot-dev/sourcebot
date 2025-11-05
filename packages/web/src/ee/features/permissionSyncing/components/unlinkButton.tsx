'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Unlink, Loader2 } from "lucide-react";
import { unlinkLinkedAccountProvider } from "../actions";
import { isServiceError } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";

interface UnlinkButtonProps {
    provider: string;
    providerName: string;
}

export const UnlinkButton = ({ provider, providerName }: UnlinkButtonProps) => {
    const [isUnlinking, setIsUnlinking] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleUnlink = async () => {
        if (!confirm(`Are you sure you want to disconnect your ${providerName} account?`)) {
            return;
        }

        setIsUnlinking(true);
        try {
            const result = await unlinkLinkedAccountProvider(provider);

            if (isServiceError(result)) {
                toast({
                    description: `❌ Failed to disconnect account. ${result.message}`,
                    variant: "destructive",
                });
                setIsUnlinking(false);
                return;
            }

            toast({
                description: `✅ ${providerName} account disconnected successfully.`,
            });

            // Refresh the page to show updated state
            router.refresh();
        } catch (error) {
            toast({
                description: `❌ Failed to disconnect account. ${error instanceof Error ? error.message : "Unknown error"}`,
                variant: "destructive",
            });
            setIsUnlinking(false);
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
        >
            {isUnlinking ? (
                <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Disconnecting...
                </>
            ) : (
                <>
                    <Unlink className="h-3.5 w-3.5 mr-1.5" />
                    Disconnect
                </>
            )}
        </Button>
    );
};
