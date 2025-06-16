import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "./queryClientProvider";
import { PostHogProvider } from "./posthogProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { env } from "@/env.mjs";
import { PlanProvider } from "@/features/entitlements/planProvider";
import { getEntitlements } from "@sourcebot/shared";

export const metadata: Metadata = {
    title: "Sourcebot",
    description: "Sourcebot",
    manifest: "/manifest.json",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            // @see : https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
            suppressHydrationWarning
        >
            <body>
                <Toaster />
                <SessionProvider>
                    <PlanProvider entitlements={getEntitlements()}>
                        <PostHogProvider disabled={env.SOURCEBOT_TELEMETRY_DISABLED === "true"}>
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
                        </PostHogProvider>
                    </PlanProvider>
                </SessionProvider>
            </body>
        </html>
    );
}