import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "./queryClientProvider";
import { PHProvider } from "./posthogProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
    title: "Sourcebot",
    description: "Sourcebot",
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