import { getRepos } from "@/actions";
import { Footer } from "@/app/components/footer";
import { getOrgFromDomain } from "@/data/org";
import { getConfiguredLanguageModelsInfo, getUserChatHistory } from "@/features/chat/actions";
import { isServiceError } from "@/lib/utils";
import { Homepage } from "./components/homepage";
import { NavigationMenu } from "./components/navigationMenu";
import { PageNotFound } from "./components/pageNotFound";
import { UpgradeToast } from "./components/upgradeToast";
import { ServiceErrorException } from "@/lib/serviceError";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { SEARCH_MODE_COOKIE_NAME } from "@/lib/constants";

export default async function Home({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    const session = await auth();

    const models = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos(domain);
    const chatHistory = session ? await getUserChatHistory(domain) : [];

    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    // Read search mode from cookie, defaulting to agentic if not set
    // (assuming a language model is configured).
    const cookieStore = await cookies();
    const searchModeCookie = cookieStore.get(SEARCH_MODE_COOKIE_NAME);
    const initialSearchMode = (
        searchModeCookie?.value === "agentic" ||
        searchModeCookie?.value === "precise"
    ) ? searchModeCookie.value : models.length > 0 ? "agentic" : "precise";

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu
                domain={domain}
            />
            <UpgradeToast />

            <Homepage
                initialRepos={indexedRepos}
                languageModels={models}
                chatHistory={chatHistory}
                initialSearchMode={initialSearchMode}
            />
            <Footer />
        </div>
    )
}
