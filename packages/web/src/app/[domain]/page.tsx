import { getRepos, getSearchContexts } from "@/actions";
import { Footer } from "@/app/components/footer";
import { getOrgFromDomain } from "@/data/org";
import { getConfiguredLanguageModelsInfo, getUserChatHistory } from "@/features/chat/actions";
import { isServiceError, measure } from "@/lib/utils";
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
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('web-homepage');

export default async function Home(props: { params: Promise<{ domain: string }> }) {
    logger.debug('Starting homepage load...');
    const { data: HomePage, durationMs } = await measure(() => HomeInternal(props), 'HomeInternal', /* outputLog = */ false);
    logger.debug(`Homepage load completed in ${durationMs}ms.`);

    return HomePage;
}

const HomeInternal = async (props: { params: Promise<{ domain: string }> }) => {
    const params = await props.params;

    const {
        domain
    } = params;


    const org = (await measure(() => getOrgFromDomain(domain), 'getOrgFromDomain')).data;
    if (!org) {
        return <PageNotFound />
    }

    const session = (await measure(() => auth(), 'auth')).data;
    const models = (await measure(() => getConfiguredLanguageModelsInfo(), 'getConfiguredLanguageModelsInfo')).data;
    const repos = (await measure(() => getRepos(), 'getRepos')).data;
    const searchContexts = (await measure(() => getSearchContexts(domain), 'getSearchContexts')).data;
    const chatHistory = session ? (await measure(() => getUserChatHistory(domain), 'getUserChatHistory')).data : [];

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

    // Read search mode from cookie, defaulting to agentic if not set
    // (assuming a language model is configured).
    const cookieStore = (await measure(() => cookies(), 'cookies')).data;
    const searchModeCookie = cookieStore.get(SEARCH_MODE_COOKIE_NAME);
    const initialSearchMode = (
        searchModeCookie?.value === "agentic" ||
        searchModeCookie?.value === "precise"
    ) ? searchModeCookie.value : models.length > 0 ? "agentic" : "precise";

    const isAgenticSearchTutorialDismissed = cookieStore.get(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME)?.value === "true";

    const demoExamples = env.SOURCEBOT_DEMO_EXAMPLES_PATH ? await (async () => {
        try {
            return (await measure(() => loadJsonFile<DemoExamples>(env.SOURCEBOT_DEMO_EXAMPLES_PATH!, demoExamplesSchema), 'loadExamplesJsonFile')).data;
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