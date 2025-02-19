import { listRepositories } from "@/lib/server/searchService";
import { isServiceError } from "@/lib/utils";
import { Suspense } from "react";
import { NavigationMenu } from "./components/navigationMenu";
import { RepositoryCarousel } from "./components/repositoryCarousel";
import { SearchBar } from "./components/searchBar";
import { Separator } from "@/components/ui/separator";
import { SymbolIcon } from "@radix-ui/react-icons";
import { UpgradeToast } from "./components/upgradeToast";
import Link from "next/link";
import { getOrgFromDomain } from "@/data/org";
import { PageNotFound } from "./components/pageNotFound";
import { Footer } from "./components/footer";
import { SourcebotLogo } from "../components/sourcebotLogo";


export default async function Home({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu
                domain={domain}
            />
            <UpgradeToast />
            <div className="flex flex-col justify-center items-center mt-8 mb-8 md:mt-18 w-full px-5">
                <div className="max-h-44 w-auto">
                    <SourcebotLogo
                        className="h-18 md:h-40 w-auto"
                    />
                </div>
                <SearchBar
                    autoFocus={true}
                    className="mt-4 w-full max-w-[800px]"
                />
                <div className="mt-8">
                    <Suspense fallback={<div>...</div>}>
                        <RepositoryList
                            orgId={org.id}
                            domain={domain}
                        />
                    </Suspense>
                </div>
                <div className="flex flex-col items-center w-fit gap-6">
                    <Separator className="mt-5" />
                    <span className="font-semibold">How to search</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <HowToSection
                            title="Search in files or paths"
                        >
                            <QueryExample>
                                <Query query="test todo">test todo</Query> <QueryExplanation>(both test and todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="test or todo">test <Highlight>or</Highlight> todo</Query> <QueryExplanation>(either test or todo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query={`"exit boot"`}>{`"exit boot"`}</Query> <QueryExplanation>(exact match)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="TODO case:yes">TODO <Highlight>case:</Highlight>yes</Query> <QueryExplanation>(case sensitive)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Filter results"
                        >
                            <QueryExample>
                                <Query query="file:README setup"><Highlight>file:</Highlight>README setup</Query> <QueryExplanation>(by filename)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="repo:torvalds/linux test"><Highlight>repo:</Highlight>torvalds/linux test</Query> <QueryExplanation>(by repo)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="lang:typescript"><Highlight>lang:</Highlight>typescript</Query> <QueryExplanation>(by language)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="rev:HEAD"><Highlight>rev:</Highlight>HEAD</Query> <QueryExplanation>(by branch or tag)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                        <HowToSection
                            title="Advanced"
                        >
                            <QueryExample>
                                <Query query="file:\.py$"><Highlight>file:</Highlight>{`\\.py$`}</Query> <QueryExplanation>{`(files that end in ".py")`}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="sym:main"><Highlight>sym:</Highlight>main</Query> <QueryExplanation>{`(symbols named "main")`}</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="todo -lang:c">todo <Highlight>-lang:c</Highlight></Query> <QueryExplanation>(negate filter)</QueryExplanation>
                            </QueryExample>
                            <QueryExample>
                                <Query query="content:README"><Highlight>content:</Highlight>README</Query> <QueryExplanation>(search content only)</QueryExplanation>
                            </QueryExample>
                        </HowToSection>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    )
}

const RepositoryList = async ({ orgId, domain }: { orgId: number, domain: string }) => {
    const _repos = await listRepositories(orgId);

    if (isServiceError(_repos)) {
        return null;
    }

    const repos = _repos.List.Repos.map((repo) => repo.Repository);

    if (repos.length === 0) {
        return (
            <div className="flex flex-row items-center gap-3">
                <SymbolIcon className="h-4 w-4 animate-spin" />
                <span className="text-sm">indexing in progress...</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-3">
            <span className="text-sm">
                {`Search ${repos.length} `}
                <Link
                    href={`${domain}/repos`}
                    className="text-blue-500"
                >
                    {repos.length > 1 ? 'repositories' : 'repository'}
                </Link>
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

const Query = ({ query, children }: { query: string, children: React.ReactNode }) => {
    return (
        <Link
            href={`/search?query=${query}`}
            className="cursor-pointer hover:underline"
        >
            {children}
        </Link>
    )
}
