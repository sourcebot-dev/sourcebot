import { ChangeOrgNameCard } from "./components/changeOrgNameCard";
import { isServiceError } from "@/lib/utils";
import { getCurrentUserRole } from "@/actions";
import { getOrgFromDomain } from "@/data/org";
import { ChangeOrgDomainCard } from "./components/changeOrgDomainCard";
import { ServiceErrorException } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { headers } from "next/headers";

interface GeneralSettingsPageProps {
    params: {
        domain: string;
    }
}

export default async function GeneralSettingsPage({ params: { domain } }: GeneralSettingsPageProps) {
    const currentUserRole = await getCurrentUserRole(domain)
    if (isServiceError(currentUserRole)) {
        throw new ServiceErrorException(currentUserRole);
    }

    const org = await getOrgFromDomain(domain)
    if (!org) {
        throw new ServiceErrorException({
            message: "Failed to fetch organization.",
            statusCode: 500,
            errorCode: ErrorCode.NOT_FOUND,
        });
    }

    const host = (await headers()).get('host') ?? '';

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
                rootDomain={host}
            />
        </div>
    )
}

