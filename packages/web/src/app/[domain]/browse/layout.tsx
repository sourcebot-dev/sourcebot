import { auth } from "@/auth";
import { LayoutClient } from "./layoutClient";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({
    children,
}: LayoutProps) {
    const session = await auth();
    return (
        <LayoutClient session={session}>
            {children}
        </LayoutClient>
    )
}
