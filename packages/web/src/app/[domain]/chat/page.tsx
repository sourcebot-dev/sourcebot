import { getRepos, getReposStats, getSearchContexts } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { getConfiguredLanguageModelsInfo, getUserChatHistory } from "@/features/chat/actions";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError, measure } from "@/lib/utils";
import { LandingPageChatBox } from "./components/landingPageChatBox";
import { RepositoryCarousel } from "../components/repositoryCarousel";
import { NavigationMenu } from "../components/navigationMenu";
import { Separator } from "@/components/ui/separator";
import { DemoCards } from "./components/demoCards";
import { env } from "@sourcebot/shared";
import { loadJsonFile } from "@sourcebot/shared";
import { DemoExamples, demoExamplesSchema } from "@/types";
import { auth } from "@/auth";
import ChatHistoryCard from "./components/chatHistoryCard";
import { CHAT_HISTORY_DISPLAY_LIMIT } from "@/lib/constants";

interface PageProps {
    params: Promise<{
        domain: string;
    }>;
}

export default async function Page(props: PageProps) {
    const params = await props.params;
    const languageModels = await getConfiguredLanguageModelsInfo();
    const searchContexts = await getSearchContexts(params.domain);
    const allRepos = await getRepos();
    const session = await auth();
    const chatHistory = session ? await getUserChatHistory() : [];

    const carouselRepos = await getRepos({
        where: {
            indexedAt: {
                not: null,
            },
        },
        take: 10,
    });

    const repoStats = await getReposStats();

    if (isServiceError(allRepos)) {
        throw new ServiceErrorException(allRepos);
    }

    if (isServiceError(searchContexts)) {
        throw new ServiceErrorException(searchContexts);
    }

    if (isServiceError(carouselRepos)) {
        throw new ServiceErrorException(carouselRepos);
    }

    if (isServiceError(repoStats)) {
        throw new ServiceErrorException(repoStats);
    }

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

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
                domain={params.domain}
            />

            <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
                <div className="max-h-44 w-auto">
                    <SourcebotLogo
                        className="h-18 md:h-40 w-auto"
                    />
                </div>
                <CustomSlateEditor>
                    <LandingPageChatBox
                        languageModels={languageModels}
                        repos={allRepos}
                        searchContexts={searchContexts}
                    />
                </CustomSlateEditor>

                <div className="mt-8">
                    <RepositoryCarousel
                        numberOfReposWithIndex={repoStats.numberOfReposWithIndex}
                        displayRepos={carouselRepos}
                    />
                </div>

                {demoExamples && (
                    <>
                        <div className="flex flex-col items-center w-fit gap-6">
                            <Separator className="mt-5 w-[700px]" />
                        </div>

                        <DemoCards
                            demoExamples={demoExamples}
                        />
                    </>
                )}

                {chatHistory.length > 0 && (
                    <>
                        <div className="flex flex-col items-center w-fit gap-6">
                            <Separator className="mt-5 w-[700px]" />
                        </div>
                        <div className="w-full max-w-4xl mt-8 flex flex-col items-center">
                            <h2 className="text-2xl font-semibold mb-4">Recent Chats</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {chatHistory.slice(0, CHAT_HISTORY_DISPLAY_LIMIT).map((chat) => (
                                    <ChatHistoryCard
                                        key={chat.id}
                                        chat={chat}
                                        domain={params.domain}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}