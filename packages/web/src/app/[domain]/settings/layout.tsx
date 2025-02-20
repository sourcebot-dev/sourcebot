import { Metadata } from "next"
import { SidebarNav } from "./components/sidebar-nav"
import { NavigationMenu } from "../components/navigationMenu"
import { Header } from "./components/header";
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
            title: "General",
            href: `/${domain}/settings`,
        },
        {
            title: "Billing",
            href: `/${domain}/settings/billing`,
        },
        {
            title: "Members",
            href: `/${domain}/settings/members`,
        }
    ]

    return (
        <div className="min-h-screen flex flex-col">
            <NavigationMenu domain={domain} />
            <div className="flex-grow flex justify-center p-4 bg-[#fafafa] dark:bg-background relative">
                <div className="w-full max-w-6xl">
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