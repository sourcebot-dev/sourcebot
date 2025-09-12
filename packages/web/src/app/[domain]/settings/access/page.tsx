import { getOrgFromDomain } from "@/data/org";
import { OrganizationAccessSettings } from "@/app/components/organizationAccessSettings";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { getMe } from "@/actions";
import { OrgRole } from "@sourcebot/db";
import { redirect } from "next/navigation";

interface AccessPageProps {
    params: Promise<{
        domain: string;
    }>
}

export default async function AccessPage(props: AccessPageProps) {
    const params = await props.params;

    const {
        domain
    } = params;

    const org = await getOrgFromDomain(domain);
    if (!org) {
        throw new Error("Organization not found");
    }

    const me = await getMe();
    if (isServiceError(me)) {
        throw new ServiceErrorException(me);
    }

    const userRoleInOrg = me.memberships.find((membership) => membership.id === org.id)?.role;
    if (!userRoleInOrg) {
        throw new Error("User role not found");
    }

    if (userRoleInOrg !== OrgRole.OWNER) {
        redirect(`/${domain}/settings`);
    }

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
}