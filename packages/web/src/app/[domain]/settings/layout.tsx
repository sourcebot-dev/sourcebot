import React from "react"
import { Metadata } from "next"
import { SidebarNav, SidebarNavItem } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { getConnectionStats, getMe, getOrgAccountRequests } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { getOrgFromDomain } from "@/data/org";
import { OrgRole } from "@prisma/client";
import { env } from "@/env.mjs";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{ domain: string }>;
}

export const metadata: Metadata = {
    title: "Settings",
}

export default async function SettingsLayout(
    props: LayoutProps
) {
    const params = await props.params;

    const {
        domain
    } = params;

    const {
        children
    } = props;

    const session = await auth();
    if (!session) {
        return redirect(`/${domain}`);
    }

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

    let numJoinRequests: number | undefined;
    if (userRoleInOrg === OrgRole.OWNER) {
        const requests = await getOrgAccountRequests(domain);
        if (isServiceError(requests)) {
            throw new ServiceErrorException(requests);
        }
        numJoinRequests = requests.length;
    }

    const connectionStats = await getConnectionStats();
    if (isServiceError(connectionStats)) {
        throw new ServiceErrorException(connectionStats);
    }

    const sidebarNavItems: SidebarNavItem[] = [
        {
            title: "General",
            href: `/${domain}/settings`,
        },
        ...(IS_BILLING_ENABLED ? [
            {
                title: "Billing",
                href: `/${domain}/settings/billing`,
            }
        ] : []),
        ...(userRoleInOrg === OrgRole.OWNER ? [
            {
                title: "Access",
                href: `/${domain}/settings/access`,
            }
        ] : []),
        ...(userRoleInOrg === OrgRole.OWNER ? [{
            title: (
                <div className="flex items-center gap-2">
                    Members
                    {numJoinRequests !== undefined && numJoinRequests > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                            {numJoinRequests}
                        </span>
                    )}
                </div>
            ),
            href: `/${domain}/settings/members`,
        }] : []),
        ...(userRoleInOrg === OrgRole.OWNER ? [
            {
                title: "Connections",
                href: `/${domain}/settings/connections`,
                hrefRegex: `/${domain}/settings/connections(/[^/]+)?$`,
                isNotificationDotVisible: connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0,
            }
        ] : []),
        {
            title: "Secrets",
            href: `/${domain}/settings/secrets`,
        },
        {
            title: "API Keys",
            href: `/${domain}/settings/apiKeys`,
        },
        {
            title: "Analytics",
            href: `/${domain}/settings/analytics`,
        },
        ...(env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT === undefined ? [
            {
                title: "License",
                href: `/${domain}/settings/license`,
            }
        ] : []),
    ]

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            <main className="flex-grow flex justify-center p-4 bg-backgroundSecondary relative">
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

