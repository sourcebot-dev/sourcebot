"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { joinOrganization } from "../invite/actions";
import { isServiceError } from "@/lib/utils";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";

export function JoinOrganizationButton({ inviteLinkId }: { inviteLinkId?: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleJoinOrganization = async () => {
        setIsLoading(true);
        
        try {
            const result = await joinOrganization(SINGLE_TENANT_ORG_ID, inviteLinkId);
            
            if (isServiceError(result)) {
                toast({
                    title: "Failed to join organization",
                    description: result.message,
                    variant: "destructive",
                });
                return;
            }

            router.refresh();
        } catch (error) {
            console.error("Error joining organization:", error);
            toast({
                title: "Error",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Button 
            onClick={handleJoinOrganization}
            disabled={isLoading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium"
        >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Join Organization
        </Button>
    );
} 