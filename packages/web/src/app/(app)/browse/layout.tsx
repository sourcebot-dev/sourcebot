import { LayoutClient } from "./layoutClient";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({
    children,
}: LayoutProps) {
    const languageModels = await getConfiguredLanguageModelsInfo();
    return (
        <LayoutClient isSearchAssistSupported={languageModels.length > 0}>
            {children}
        </LayoutClient>
    )
}
