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
import { Footer } from "./components/footer";
import { headers } from "next/headers";

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
    const byPassOrgCheck = (await headers()).get("x-bypass-org-check")! == "true";
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
