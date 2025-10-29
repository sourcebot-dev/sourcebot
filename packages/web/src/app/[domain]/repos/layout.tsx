import { InfoIcon } from "lucide-react";
import { NavigationMenu } from "../components/navigationMenu";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";
import Link from "next/link";
import { getCurrentUserRole, getReposStats } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@sourcebot/db";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ domain: string }>;
}

export default async function Layout(
    props: LayoutProps
) {
    const params = await props.params;
    const { domain } = params;
    const { children } = props;

    const repoStats = await getReposStats();
    if (isServiceError(repoStats)) {
        throw new ServiceErrorException(repoStats);
    }

    const userRoleInOrg = await getCurrentUserRole(domain);

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            {(repoStats.numberOfRepos === 0 && userRoleInOrg === OrgRole.OWNER) && (
                <div className="w-full flex flex-row justify-center items-center bg-accent py-0.5">
                    <InfoIcon className="w-4 h-4 mr-1" />
                    <span><span className="font-medium">No repositories configured.</span> Create a <Link href={`/${SINGLE_TENANT_ORG_DOMAIN}/settings/connections`} className="text-link hover:underline">connection</Link> to get started.</span>
                </div>
            )}
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
                <div className="w-full max-w-6xl rounded-lg p-6">
                    <div className="container mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}