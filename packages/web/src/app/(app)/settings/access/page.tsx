import { OrganizationAccessSettings } from "@/app/components/organizationAccessSettings";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";

export default authenticatedPage(async () => {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">Access Control</h3>
                <p className="text-sm text-muted-foreground">Configure how users can access your Sourcebot deployment.{" "}
                    <a
                        href="https://docs.sourcebot.dev/docs/configuration/auth/access-settings"
                        target="_blank"
                        rel="noopener"
                        className="underline text-primary hover:text-primary/80 transition-colors"
                    >
                        Learn more
                    </a>
                </p>
            </div>

            <OrganizationAccessSettings />
        </div>
    )
}, {
    minRole: OrgRole.OWNER,
    redirectTo: '/settings',
});
