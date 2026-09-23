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
            isSearchAssistSupported={languageModels.length > 0}
            showLoginWall={env.EXPERIMENT_ASK_GH_ENABLED === "true" && !session?.user}
        >
            {children}
        </LayoutClient>
    )
}
