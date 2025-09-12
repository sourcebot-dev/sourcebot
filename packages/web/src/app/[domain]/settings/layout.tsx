import React from "react"
import { Metadata } from "next"
import { SidebarNav } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"
import { Header } from "./components/header";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { getMe, getOrgAccountRequests } from "@/actions";
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

    const sidebarNavItems = [
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
        <div className="min-h-screen flex flex-col bg-backgroundSecondary">
            <NavigationMenu domain={domain} />
            <div className="flex-grow flex justify-center p-4 relative">
                <div className="w-full max-w-6xl p-6">
                    <Header className="w-full">
                        <h1 className="text-3xl">Settings</h1>
                    </Header>
                    <div className="flex flex-row gap-10 mt-20">
                        <aside className="lg:w-48">
                            <SidebarNav items={sidebarNavItems} />
                        </aside>
                        <div className="w-full rounded-lg">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}