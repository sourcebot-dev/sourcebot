import { getRepos, getReposStats, getSearchContexts } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError, measure } from "@/lib/utils";
import { LandingPageChatBox } from "./components/landingPageChatBox";
import { RepositoryCarousel } from "../components/repositoryCarousel";
import { Separator } from "@/components/ui/separator";
import { DemoCards } from "./components/demoCards";
import { env } from "@sourcebot/shared";
import { loadJsonFile } from "@sourcebot/shared";
import { DemoExamples, demoExamplesSchema } from "@/types";
import { auth } from "@/auth";

export async function ChatLandingPage() {
    const languageModels = await getConfiguredLanguageModelsInfo();
    const searchContexts = await getSearchContexts();
    const allRepos = await getRepos();
    const session = await auth();

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

    const demoExamples = env.SOURCEBOT_DEMO_EXAMPLES_PATH ? await (async () => {
        try {
            return (await measure(() => loadJsonFile<DemoExamples>(env.SOURCEBOT_DEMO_EXAMPLES_PATH!, demoExamplesSchema), 'loadExamplesJsonFile')).data;
        } catch (error) {
            console.error('Failed to load demo examples:', error);
            return undefined;
        }
    })() : undefined;

    return (
        <div className="flex flex-col items-center h-full overflow-hidden">
                <div className="flex flex-col items-center h-full overflow-y-auto pt-8 pb-8 md:pt-16 w-full px-5">
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
                            isAuthenticated={!!session}
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
                </div>
        </div>
    )
}
