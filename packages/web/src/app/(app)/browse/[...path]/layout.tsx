import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { notFound } from "next/navigation";
import { getBrowseParamsFromPathParam } from "../hooks/utils";
import { LayoutClient } from "../layoutClient";

interface LayoutProps {
    children: React.ReactNode;
    params: Promise<{
        path: string[];
    }>;
}

export default async function Layout({
    children,
    params,
}: LayoutProps) {
    const { path } = await params;
    const browseParams = getBrowseParamsFromPathParam(path.join('/'));
    if (!browseParams) {
        notFound();
    }

    const languageModels = await getConfiguredLanguageModelsInfo();
    return (
        <LayoutClient
            browseParams={browseParams}
            isSearchAssistSupported={languageModels.length > 0}
        >
            {children}
        </LayoutClient>
    )
}
