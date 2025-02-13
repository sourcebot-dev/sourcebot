import { Metadata } from "next"

import { Separator } from "@/components/ui/separator"
import { SidebarNav } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"

export const metadata: Metadata = {
    title: "Settings",
}

export default function SettingsLayout({
    children,
    params: { domain },
}: Readonly<{
    children: React.ReactNode;
    params: { domain: string };
}>) {
    const sidebarNavItems = [
        {
            title: "Members",
            href: `/${domain}/settings`,
        },
        {
            title: "Billing",
            href: `/${domain}/settings/billing`,
        }
    ]

    return (
        <div>
            <NavigationMenu domain={domain} />
            <div className="hidden space-y-6 p-10 pb-16 md:block">
                <div className="space-y-0.5">
                    <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                    <p className="text-muted-foreground">
                        Manage your organization settings.
                    </p>
                </div>
                <Separator className="my-6" />
                <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-8 lg:space-y-0">
                    <aside className="-mx-4 lg:w-48">
                        <SidebarNav items={sidebarNavItems} />
                    </aside>
                    <div className="flex-1">{children}</div>
                </div>
            </div>
        </div>
    )
}