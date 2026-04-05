import React from "react"
import { Metadata } from "next"
import { SidebarNav } from "./components/sidebar-nav"
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { getConnectionStats, getOrgAccountRequests } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@prisma/client";
import { env, hasEntitlement } from "@sourcebot/shared";
import { withAuth } from "@/middleware/withAuth";

interface LayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: "Settings",
}

export default async function SettingsLayout(
    props: LayoutProps
) {
    const {
        children
    } = props;

    const session = await auth();
    if (!session) {
        return redirect('/');
    }

    const sidebarNavItems = await getSidebarNavItems();
    if (isServiceError(sidebarNavItems)) {
        throw new ServiceErrorException(sidebarNavItems);
    }

    return (
        <div>
            <main className="flex justify-center p-4">
                <div className="w-full max-w-6xl rounded-lg p-6">
                    <div className="container mx-auto">
                        <div className="mb-16">
                            <h1 className="text-3xl font-semibold">Settings</h1>
                        </div>
                        <div className="flex flex-row gap-10">
                            <aside className="lg:w-48">
                                <SidebarNav items={sidebarNavItems} />
                            </aside>
                            <div className="w-full rounded-lg">{children}</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

export const getSidebarNavItems = async () =>
    withAuth(async ({ role }) => {
        let numJoinRequests: number | undefined;
        if (role === OrgRole.OWNER) {
            const requests = await getOrgAccountRequests();
            if (isServiceError(requests)) {
                throw new ServiceErrorException(requests);
            }
            numJoinRequests = requests.length;
        }

        const connectionStats = await getConnectionStats();
        if (isServiceError(connectionStats)) {
            throw new ServiceErrorException(connectionStats);
        }

        return [
            ...(role === OrgRole.OWNER ? [
                {
                    title: "Access",
                    href: `/settings/access`,
                }
            ] : []),
            ...(role === OrgRole.OWNER ? [{
                title: "Members",
                isNotificationDotVisible: numJoinRequests !== undefined && numJoinRequests > 0,
                href: `/settings/members`,
            }] : []),
            ...(role === OrgRole.OWNER ? [
                {
                    title: "Connections",
                    href: `/settings/connections`,
                    hrefRegex: `/settings/connections(/[^/]+)?$`,
                    isNotificationDotVisible: connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0,
                }
            ] : []),
            ...(env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'false' || role === OrgRole.OWNER ? [
                {
                    title: "API Keys",
                    href: `/settings/apiKeys`,
                }
            ] : []),
            ...(role === OrgRole.OWNER ? [
                {
                    title: "Analytics",
                    href: `/settings/analytics`,
                },
            ] : []),
            ...(hasEntitlement("sso") ? [
                {
                    title: "Linked Accounts",
                    href: `/settings/linked-accounts`,
                }
            ] : []),
            ...(role === OrgRole.OWNER ? [
                {
                    title: "License",
                    href: `/settings/license`,
                }
            ] : []),
        ]
    });