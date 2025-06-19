import { NavigationMenu } from "./components/navigationMenu";
import { Separator } from "@/components/ui/separator";
import { UpgradeToast } from "./components/upgradeToast";
import Link from "next/link";
import { getOrgFromDomain } from "@/data/org";
import { PageNotFound } from "./components/pageNotFound";
import { Footer } from "@/app/components/footer";
import { SourcebotLogo } from "../components/sourcebotLogo";
import { RepositorySnapshot } from "./components/repositorySnapshot";
import { SyntaxReferenceGuideHint } from "./components/syntaxReferenceGuideHint";
import { getRepos } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { HomepageSearch } from "./homepageSearch";

export default async function Home({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    const repos = await getRepos(domain);

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
                <HomepageSearch />
                <div className="mt-8">
                    <RepositorySnapshot
                        repos={isServiceError(repos) ? [] : repos}
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
            <Footer />
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
