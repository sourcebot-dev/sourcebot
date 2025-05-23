"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getPublicAccessStatus } from "@/ee/features/publicAccess/publicAccess";
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface EnterpriseFeaturesCardProps {
    domain: string;
}

export function EnterpriseFeaturesCard({ domain }: EnterpriseFeaturesCardProps) {
    const [isPublicAccessEnabled, setIsPublicAccessEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStatus() {
            try {
                setError(null);
                const status = await getPublicAccessStatus(domain);
                if (isServiceError(status)) {
                    throw new ServiceErrorException(status);
                }
                setIsPublicAccessEnabled(status);
            } catch (error) {
                console.error("Failed to fetch public access status:", error);
                setError(error instanceof Error ? error.message : "Failed to fetch public access status");
            } finally {
                setIsLoading(false);
            }
        }
        fetchStatus();
    }, [domain]);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4">
                <CardTitle>
                    Enterprise Features
                </CardTitle>
                <CardDescription>
                    The following settings are for features that require an enterprise license. If you&apos;d like to enquire about an enterprise license,
                    or would like to request a trial, reach out to us using our <a href="https://sourcebot.dev/contact" target="_blank" rel="noopener noreferrer" className="text-primary">contact form</a>.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {error && (
                    <div className="p-3 bg-destructive/15 text-destructive rounded-md flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                <div className="flex items-center space-x-4 mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            checked={isPublicAccessEnabled}
                            disabled={true}
                            id="public-access-status"
                            className={isLoading ? "opacity-80" : ""}
                        />
                        {isLoading && (
                            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="public-access-status">Public Access</Label>
                        <p className="text-sm text-muted-foreground">
                            When enabled, enables unauthenticated access to your Sourcebot deployment. Requires an enterprise license with an unlimited number of seats.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
