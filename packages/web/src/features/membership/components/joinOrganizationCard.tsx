'use client';

import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { joinOrganization } from "@/features/membership/actions";
import { isServiceError } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoutEscapeHatch } from "../../../app/components/logoutEscapeHatch";

export function JoinOrganizationCard({ inviteLinkId }: { inviteLinkId?: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleJoinOrganization = async () => {
        setIsLoading(true);

        try {
            const result = await joinOrganization(inviteLinkId);

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
        <div className="min-h-screen flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <SourcebotLogo className="h-12 mb-4 mx-auto" size="large" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="text-center space-y-4">
                        <p className="text-[var(--muted-foreground)] text-[15px] leading-6">
                            Welcome to Sourcebot! Click the button below to join this organization.
                        </p>
                    </div>
                    <Button
                        onClick={handleJoinOrganization}
                        disabled={isLoading}
                        className="w-full h-11 bg-primary hover:bg-primary/90 text-[var(--primary-foreground)] transition-all duration-200 font-medium"
                    >
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Join Organization
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}