import { listRepositories } from "@/lib/server/searchService";
import { isServiceError } from "@/lib/utils";
import Image from "next/image";
import { Suspense } from "react";
import logoDark from "../../public/sb_logo_dark_large.png";
import logoLight from "../../public/sb_logo_light_large.png";
import { NavigationMenu } from "./navigationMenu";
import { RepositoryCarousel } from "./repositoryCarousel";
import { SearchBar } from "./searchBar";
import { Separator } from "@/components/ui/separator";


export default async function Home() {
    return (
        <div className="h-screen flex flex-col items-center">
            {/* TopBar */}
            <NavigationMenu />

            <div className="flex flex-col justify-center items-center mt-8 md:mt-32 max-w-[90%]">
                <div className="max-h-44 w-auto">
                    <Image
                        src={logoDark}
                        className="w-full h-full hidden dark:block"
                        alt={"Sourcebot logo"}
                        priority={true}
                    />
                    <Image
                        src={logoLight}
                        className="w-full h-full block dark:hidden"
                        alt={"Sourcebot logo"}
                        priority={true}
                    />
                </div>
                <div className="w-full flex flex-row mt-4">
                    <SearchBar
                        autoFocus={true}
                    />
                </div>
                <div className="mt-8">
                    <Suspense fallback={<div>...</div>}>
                        <RepositoryList />
                    </Suspense>
                </div>
                <Separator className="mt-5 mb-8" />
                <div className="flex flex-col items-center w-fit gap-6">
                    <span className="font-semibold">How to search</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <HowToSection
                            title="Search in files or paths"
                        >
                            <QueryExample>
                                test todo <QueryExplanation>(both test and todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                test <Highlight>or</Highlight> todo <QueryExplanation>(either test or todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                "exit boot" <QueryExplanation>(exact match)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                TODO <Highlight>case:</Highlight>yes <QueryExplanation>(case sensitive)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Filter results"
                        >
                            <QueryExample>
                                <Highlight>file:</Highlight>README setup <QueryExplanation>(by filename)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Highlight>repo:</Highlight>torvalds/linux test <QueryExplanation>(by repo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Highlight>lang:</Highlight>typescript <QueryExplanation>(by language)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Highlight>branch:</Highlight>HEAD <QueryExplanation>(by branch)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Advanced"
                        >
                            <QueryExample>
                                <Highlight>file:</Highlight>\.py$ <QueryExplanation>(files that end in ".py")</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Highlight>sym:</Highlight>main <QueryExplanation>(symbols named "main")</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                todo <Highlight>-lang:c</Highlight> <QueryExplanation>(negate filter)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Highlight>content:</Highlight>README<QueryExplanation>(search content only)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                    </div>
                </div>
            </div>
        </div>
    )
}

const RepositoryList = async () => {
    const _repos = await listRepositories();

    if (isServiceError(_repos)) {
        return null;
    }

    const repos = _repos.List.Repos.map((repo) => repo.Repository);

    if (repos.length === 0) {
        return <span>
            Get started
            <a
                href="https://github.com/TaqlaAI/sourcebot/blob/main/README.md"
                className="text-blue-500"
            >
                {` configuring Sourcebot.`}
            </a>
        </span>;
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">
                {`Search ${repos.length} `}
                <a
                    href="/repos"
                    className="text-blue-500"
                >
                    {repos.length > 1 ? 'repositories' : 'repository'}
                </a>
            </span>
            <RepositoryCarousel repos={repos} />
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
        <span className="text-blue-700 dark:text-blue-500">
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