import { SourcebotLogo } from "@/app/components/sourcebotLogo"
import { NavigationMenu } from "../../components/navigationMenu"
import { RepositoryCarousel } from "../../components/repositoryCarousel"
import { Separator } from "@/components/ui/separator"
import { SyntaxReferenceGuideHint } from "../../components/syntaxReferenceGuideHint"
import Link from "next/link"
import { SearchBar } from "../../components/searchBar"
import { SearchModeSelector } from "../../components/searchModeSelector"
import { getRepos, getReposStats } from "@/actions"
import { ServiceErrorException } from "@/lib/serviceError"
import { isServiceError } from "@/lib/utils"

export interface SearchLandingPageProps {
    domain: string;
}

export const SearchLandingPage = async ({
    domain,
}: SearchLandingPageProps) => {
    const carouselRepos = await getRepos({
        where: {
            indexedAt: {
                not: null,
            },
        },
        take: 10,
    });

    const repoStats = await getReposStats();

    if (isServiceError(carouselRepos)) throw new ServiceErrorException(carouselRepos);
    if (isServiceError(repoStats)) throw new ServiceErrorException(repoStats);

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu
                domain={domain}
            />

            <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
                <div className="max-h-44 w-auto">
                    <SourcebotLogo
                        className="h-18 md:h-40 w-auto"
                    />
                </div>
                <div className="mt-4 w-full max-w-[800px] border rounded-md shadow-sm">
                    <SearchBar
                        autoFocus={true}
                        className="border-none pt-0.5 pb-0"
                    />
                    <Separator />
                    <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                        <SearchModeSelector
                            searchMode="precise"
                            className="ml-auto"
                        />
                    </div>
                </div>

                <div className="mt-8">
                    <RepositoryCarousel
                        numberOfReposWithIndex={repoStats.numberOfReposWithIndex}
                        displayRepos={carouselRepos}
                    />
                </div>

                <div className="flex flex-col items-center w-fit gap-6">
                    <Separator className="mt-5" />
                    <span className="font-semibold">How to search</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <HowToSection
                            title="Search in files or paths"
                        >
                            <QueryExample>
                                <Query query="test todo" domain={domain}>test todo</Query> <QueryExplanation>(both test and todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="test or todo" domain={domain}>test <Highlight>or</Highlight> todo</Query> <QueryExplanation>(either test or todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query={`"exit boot"`} domain={domain}>{`"exit boot"`}</Query> <QueryExplanation>(exact match)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="TODO case:yes" domain={domain}>TODO <Highlight>case:</Highlight>yes</Query> <QueryExplanation>(case sensitive)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Filter results"
                        >
                            <QueryExample>
                                <Query query="file:README setup" domain={domain}><Highlight>file:</Highlight>README setup</Query> <QueryExplanation>(by filename)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="repo:torvalds/linux test" domain={domain}><Highlight>repo:</Highlight>torvalds/linux test</Query> <QueryExplanation>(by repo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="lang:typescript" domain={domain}><Highlight>lang:</Highlight>typescript</Query> <QueryExplanation>(by language)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="rev:HEAD" domain={domain}><Highlight>rev:</Highlight>HEAD</Query> <QueryExplanation>(by branch or tag)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Advanced"
                        >
                            <QueryExample>
                                <Query query="file:\.py$" domain={domain}><Highlight>file:</Highlight>{`\\.py$`}</Query> <QueryExplanation>{`(files that end in ".py")`}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="sym:main" domain={domain}><Highlight>sym:</Highlight>main</Query> <QueryExplanation>{`(symbols named "main")`}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="todo -lang:c" domain={domain}>todo <Highlight>-lang:c</Highlight></Query> <QueryExplanation>(negate filter)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="content:README" domain={domain}><Highlight>content:</Highlight>README</Query> <QueryExplanation>(search content only)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                    </div>
                    <SyntaxReferenceGuideHint />
                </div>
            </div>
        </div>
    )
}

const HowToSection = ({ title, children }: { title: string, children: React.ReactNode }) => {
    return (
        <div className="flex flex-col gap-1">
            <span className="dark:text-gray-300 text-sm mb-2 underline">{title}</span>
            {children}
        </div>
    )

}

const Highlight = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-highlight">
            {children}
        </span>
    )
}

const QueryExample = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-sm font-mono">
            {children}
        </span>
    )
}

const QueryExplanation = ({ children }: { children: React.ReactNode }) => {
    return (
        <span className="text-gray-500 dark:text-gray-400 ml-3">
            {children}
        </span>
    )
}

const Query = ({ query, domain, children }: { query: string, domain: string, children: React.ReactNode }) => {
    return (
        <Link
            href={`/${domain}/search?query=${query}`}
            className="cursor-pointer hover:underline"
        >
            {children}
        </Link>
    )
}