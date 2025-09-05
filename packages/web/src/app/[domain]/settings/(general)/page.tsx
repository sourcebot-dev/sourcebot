import { ChangeOrgNameCard } from "./components/changeOrgNameCard";
import { isServiceError } from "@/lib/utils";
import { getCurrentUserRole, getDefaultSearchMode } from "@/actions";
import { getOrgFromDomain } from "@/data/org";
import { ChangeOrgDomainCard } from "./components/changeOrgDomainCard";
import { DefaultSearchModeCard } from "./components/defaultSearchModeCard";
import { ServiceErrorException } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { headers } from "next/headers";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/actions";
import { OrgRole } from "@sourcebot/db";

interface GeneralSettingsPageProps {
    params: Promise<{
        domain: string;
    }>
}

export default async function GeneralSettingsPage(props: GeneralSettingsPageProps) {
    const params = await props.params;

    const {
        domain
    } = params;

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

    // Get the default search mode setting
    const defaultSearchMode = await getDefaultSearchMode(domain);
    const initialDefaultMode = isServiceError(defaultSearchMode) ? "precise" : defaultSearchMode;

    // Get available language models to determine if "Ask" mode is available
    const languageModels = await getConfiguredLanguageModelsInfo();
    const isAskModeAvailable = languageModels.length > 0;

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

            {currentUserRole === OrgRole.OWNER && (
                <DefaultSearchModeCard
                    initialDefaultMode={initialDefaultMode}
                    currentUserRole={currentUserRole}
                    isAskModeAvailable={isAskModeAvailable}
                />
            )}
        </div>
    )
}

