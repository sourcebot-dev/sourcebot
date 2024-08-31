import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

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
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    {/*
                        @todo : ideally we don't wrap everything in a suspense boundary.
                        @see : https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
                    */}
                    <Suspense>
                        {children}
                    </Suspense>
                </ThemeProvider>
            </body>
        </html>
    );
}
