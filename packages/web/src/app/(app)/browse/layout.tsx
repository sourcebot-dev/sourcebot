import { auth } from "@/auth";
import { LayoutClient } from "./layoutClient";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({
    children,
}: LayoutProps) {
    const session = await auth();
    const languageModels = await getConfiguredLanguageModelsInfo();
    return (
        <LayoutClient session={session} isSearchAssistSupported={languageModels.length > 0}>
            {children}
        </LayoutClient>
    )
}
