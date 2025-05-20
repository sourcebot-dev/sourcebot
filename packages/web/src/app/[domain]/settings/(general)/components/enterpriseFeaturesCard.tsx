import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgRole } from "@sourcebot/db";
import { PublicAccessToggle } from "@/ee/features/publicAccess/components/publicAccessToggle";
import { hasEntitlement } from "@/features/entitlements/server";

interface EnterpriseFeaturesCardProps {
    currentUserRole: OrgRole;
    domain: string;
}

export function EnterpriseFeaturesCard({ currentUserRole, domain }: EnterpriseFeaturesCardProps) {
    const hasPublicAccessEntitlement = hasEntitlement("public-access");
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
            <CardContent>
                <PublicAccessToggle currentUserRole={currentUserRole} domain={domain} hasPublicAccessEntitlement={hasPublicAccessEntitlement}/>
            </CardContent>
        </Card>
    );
}
