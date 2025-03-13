import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { QueryClientProvider } from "./queryClientProvider";
import { PHProvider } from "./posthogProvider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./syntaxGuideProvider";

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
                <PHProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <QueryClientProvider>
                            <TooltipProvider>
                                <SyntaxGuideProvider>
                                    {/*
                                        @todo : ideally we don't wrap everything in a suspense boundary.
                                        @see : https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
                                    */}
                                    <Suspense>
                                        {children}
                                    </Suspense>
                                    <SyntaxReferenceGuide />
                                </SyntaxGuideProvider>
                            </TooltipProvider>
                        </QueryClientProvider>
                    </ThemeProvider>
                </PHProvider>
            </body>
        </html>
    );
}
