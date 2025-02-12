import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "./queryClientProvider";
import { PHProvider } from "./posthogProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { getCurrentUserOrg } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { NavigationMenu } from "./components/navigationMenu";
import { NoOrganizationCard } from "./components/noOrganizationCard";
import { PaywallCard } from "./components/payWall/paywallCard";
import { Footer } from "./components/footer";
import { headers } from "next/headers";
import { fetchSubscription } from "@/actions";

export const metadata: Metadata = {
    title: "Sourcebot",
    description: "Sourcebot",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const orgId = await getCurrentUserOrg();
    console.log(`orgId: ${orgId}`);
    
    const byPassOrgCheck = (await headers()).get("x-bypass-org-check")! == "true";
    console.log(`bypassOrgCheck: ${byPassOrgCheck}`);
    if (isServiceError(orgId) && !byPassOrgCheck) {
        return (
            <html
                lang="en"
                // @see : https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
                suppressHydrationWarning
            >
                <body>
                    <div className="flex flex-col items-center overflow-hidden min-h-screen">
                        <SessionProvider>
                            <NavigationMenu />
                            <NoOrganizationCard />
                            <Footer />
                        </SessionProvider>
                    </div>
                    )
                </body>
            </html>
        )
    }

    const bypassPaywall = (await headers()).get("x-bypass-paywall")! == "true";
    console.log(bypassPaywall);
    if (!isServiceError(orgId) && !bypassPaywall) {
        const subscription = await fetchSubscription(orgId as number);
        if (isServiceError(subscription)) {
            // TODO: display something better here
            return (
                <div className="mt-8 text-red-500">
                    Error: {subscription.message}
                </div>
            )
        }
        console.log(subscription.status);

        if(subscription.status !== "active" && subscription.status !== "trialing") {
            return (
                <html
                lang="en"
                // @see : https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
                suppressHydrationWarning
            >
                <body>
                    <div className="flex flex-col items-center overflow-hidden min-h-screen">
                        <SessionProvider>
                            <NavigationMenu />
                            <PaywallCard orgId={orgId}/>
                            <Footer />
                        </SessionProvider>
                    </div>
                </body>
                </html>
            )
        }
    }

    return (
        <html
            lang="en"
            // @see : https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
            suppressHydrationWarning
        >
            <body>
                <Toaster />
                <SessionProvider>
                    <PHProvider>
                        <ThemeProvider
                            attribute="class"
                            defaultTheme="system"
                            enableSystem
                            disableTransitionOnChange
                        >
                            <QueryClientProvider>
                                <TooltipProvider>
                                    {children}
                                </TooltipProvider>
                            </QueryClientProvider>
                        </ThemeProvider>
                    </PHProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
