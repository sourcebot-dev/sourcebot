"use client";

import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { Button } from "@/components/ui/button";
import { UsersRound } from "lucide-react";

interface OrgAtCapacityCardProps {
    onRetry: () => void;
}

export const OrgAtCapacityCard = ({ onRetry }: OrgAtCapacityCardProps) => {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />

            <div className="w-full max-w-md">
                <div className="text-center space-y-8">
                    <SourcebotLogo
                        className="h-10 mx-auto"
                        size="large"
                    />

                    <div className="space-y-6">
                        <div className="w-12 h-12 mx-auto bg-accent rounded-full flex items-center justify-center">
                            <UsersRound className="w-6 h-6 text-accent-foreground" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold text-foreground">
                                Organization at capacity
                            </h1>
                            <p className="text-muted-foreground text-base">
                                This organization has reached its seat limit. Ask an owner to add seats or deactivate an inactive member.
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={onRetry}
                        variant="outline"
                        className="w-full"
                    >
                        Try again
                    </Button>
                </div>
            </div>
        </div>
    );
};
