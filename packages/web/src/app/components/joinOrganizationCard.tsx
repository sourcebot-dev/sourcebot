import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { JoinOrganizationButton } from "./joinOrganizationButton";

export function JoinOrganizationCard({ inviteLinkId }: { inviteLinkId?: string }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] to-[var(--accent)]/30 flex items-center justify-center p-6">
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
                    <JoinOrganizationButton inviteLinkId={inviteLinkId} />
                </CardContent>
            </Card>
        </div>
    );
}