import React from "react"
import { Metadata } from "next"
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { getConnectionStats, getOrgAccountRequests } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@prisma/client";
import { env, hasEntitlement } from "@sourcebot/shared";
import { withAuth } from "@/middleware/withAuth";
import { NavGroup } from "../@sidebar/components/settingsSidebar/nav";

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

    return (
        <div>
            <main className="flex justify-center p-4">
                <div className="w-full max-w-3xl rounded-lg p-6">
                    <div className="w-full rounded-lg">{children}</div>
                </div>
            </main>
        </div>
    )
}

export const getSidebarNavGroups = async () =>
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

        const groups: NavGroup[] = [
            {
                label: "Account",
                items: [
                    {
                        title: "Profile",
                        href: `/settings/profile`,
                        icon: "user" as const,
                    },
                    ...(env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'false' || role === OrgRole.OWNER ? [
                        {
                            title: "API Keys",
                            href: `/settings/apiKeys`,
                            icon: "key-round" as const,
                        }
                    ] : []),
                    ...(hasEntitlement("sso") ? [
                        {
                            title: "Linked Accounts",
                            href: `/settings/linked-accounts`,
                            icon: "link" as const,
                        }
                    ] : []),
                ],
            },
        ];

        if (role === OrgRole.OWNER) {
            groups.push({
                label: "Workspace",
                items: [
                    {
                        title: "Access",
                        href: `/settings/access`,
                        icon: "shield" as const,
                    },
                    {
                        title: "Members",
                        isNotificationDotVisible: numJoinRequests !== undefined && numJoinRequests > 0,
                        href: `/settings/members`,
                        icon: "users" as const,
                    },
                    {
                        title: "Connections",
                        href: `/settings/connections`,
                        hrefRegex: `/settings/connections(/[^/]+)?$`,
                        isNotificationDotVisible: connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0,
                        icon: "plug" as const,
                    },
                    {
                        title: "Analytics",
                        href: `/settings/analytics`,
                        icon: "chart-area" as const,
                    },
                    {
                        title: "License",
                        href: `/settings/license`,
                        icon: "scroll-text" as const,
                    },
                ],
            });
        }

        return groups.filter(g => g.items.length > 0);
    });