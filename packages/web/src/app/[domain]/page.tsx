import { getDefaultSearchMode, getRepos, getSearchContexts } from "@/actions";
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
import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, SEARCH_MODE_COOKIE_NAME } from "@/lib/constants";
import { env } from "@/env.mjs";
import { loadJsonFile } from "@sourcebot/shared";
import { DemoExamples, demoExamplesSchema } from "@/types";

export default async function Home(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params;

    const {
        domain
    } = params;

    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    const session = await auth();

    const models = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos(domain);
    const searchContexts = await getSearchContexts(domain);
    const chatHistory = session ? await getUserChatHistory(domain) : [];

    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    if (isServiceError(searchContexts)) {
        throw new ServiceErrorException(searchContexts);
    }

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    // Get org's default search mode
    const defaultSearchMode = await getDefaultSearchMode(domain);
    // If there was an error or no setting found, default to precise (search)
    const orgDefaultMode = isServiceError(defaultSearchMode) ? "precise" : defaultSearchMode;

    // Read search mode from cookie, defaulting to the org's default setting if not set
    const cookieStore = await cookies();
    const searchModeCookie = cookieStore.get(SEARCH_MODE_COOKIE_NAME);
    const initialSearchMode = (
        searchModeCookie?.value === "agentic" ||
        searchModeCookie?.value === "precise"
    ) ? searchModeCookie.value : orgDefaultMode;

    const isAgenticSearchTutorialDismissed = cookieStore.get(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME)?.value === "true";

    const demoExamples = env.SOURCEBOT_DEMO_EXAMPLES_PATH ? await (async () => {
        try {
            return await loadJsonFile<DemoExamples>(env.SOURCEBOT_DEMO_EXAMPLES_PATH!, demoExamplesSchema);
        } catch (error) {
            console.error('Failed to load demo examples:', error);
            return undefined;
        }
    })() : undefined;

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu
                domain={domain}
            />
            <UpgradeToast />

            <Homepage
                initialRepos={indexedRepos}
                searchContexts={searchContexts}
                languageModels={models}
                chatHistory={chatHistory}
                initialSearchMode={initialSearchMode}
                demoExamples={demoExamples}
                isAgenticSearchTutorialDismissed={isAgenticSearchTutorialDismissed}
            />
            <Footer />
        </div>
    )
}
