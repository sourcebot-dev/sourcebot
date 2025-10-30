import { getRepos, getReposStats, getSearchContexts } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/actions";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError, measure } from "@/lib/utils";
import { LandingPageChatBox } from "./components/landingPageChatBox";
import { RepositoryCarousel } from "../components/repositoryCarousel";
import { NavigationMenu } from "../components/navigationMenu";
import { Separator } from "@/components/ui/separator";
import { DemoCards } from "./components/demoCards";
import { env } from "@/env.mjs";
import { loadJsonFile } from "@sourcebot/shared";
import { DemoExamples, demoExamplesSchema } from "@/types";

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

            </div>
        </div>
    )
}