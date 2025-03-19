import { ChangeOrgNameCard } from "./components/changeOrgNameCard";
import { isServiceError } from "@/lib/utils";
import { getCurrentUserRole } from "@/actions";
import { getOrgFromDomain } from "@/data/org";
import { ChangeOrgDomainCard } from "./components/changeOrgDomainCard";
import { env } from "@/env.mjs";

interface GeneralSettingsPageProps {
    params: {
        domain: string;
    }
}

export default async function GeneralSettingsPage({ params: { domain } }: GeneralSettingsPageProps) {
    const currentUserRole = await getCurrentUserRole(domain)
    if (isServiceError(currentUserRole)) {
        return <div>Failed to fetch user role. Please contact us at team@sourcebot.dev if this issue persists.</div>
    }

    const org = await getOrgFromDomain(domain)
    if (!org) {
        return <div>Failed to fetch organization. Please contact us at team@sourcebot.dev if this issue persists.</div>
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-medium">General Settings</h3>
            </div>

            <ChangeOrgNameCard
                orgName={org.name}
                currentUserRole={currentUserRole}
            />

            <ChangeOrgDomainCard
                orgDomain={org.domain}
                currentUserRole={currentUserRole}
                rootDomain={env.SOURCEBOT_ROOT_DOMAIN}
            />
        </div>
    )
}

