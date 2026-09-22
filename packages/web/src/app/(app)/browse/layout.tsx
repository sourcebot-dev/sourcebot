import { LayoutClient } from "./layoutClient";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { auth } from "@/auth";
import { env } from "@sourcebot/shared";

interface LayoutProps {
    children: React.ReactNode;
}

export default async function Layout({
    children,
}: LayoutProps) {
    const [languageModels, session] = await Promise.all([
        getConfiguredLanguageModelsInfo(),
        auth(),
    ]);
    return (
        <LayoutClient
            isAuthenticated={!!session?.user}
            isLoginWallEnabled={env.EXPERIMENT_ASK_GH_ENABLED === "true"}
            isSearchAssistSupported={languageModels.length > 0}
        >
            {children}
        </LayoutClient>
    )
}
