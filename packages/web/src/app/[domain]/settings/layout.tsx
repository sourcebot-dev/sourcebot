import { Metadata } from "next"
import { SidebarNav } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"
import { Header } from "./components/header";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = {
    title: "Settings",
}

export default async function SettingsLayout({
    children,
    params: { domain },
}: Readonly<{
    children: React.ReactNode;
    params: { domain: string };
}>) {
    const session = await auth();
    if (!session) {
        return redirect(`/${domain}`);
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
        {
            title: "Members",
            href: `/${domain}/settings/members`,
        },
        {
            title: "Secrets",
            href: `/${domain}/settings/secrets`,
        }
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