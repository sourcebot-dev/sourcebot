import { listRepositories } from "@/lib/server/searchService";
import { isServiceError } from "@/lib/utils";
import Image from "next/image";
import { Suspense } from "react";
import logoDark from "../../public/sb_logo_dark_large.png";
import logoLight from "../../public/sb_logo_light_large.png";
import { NavigationMenu } from "./navigationMenu";
import { RepositoryCarousel } from "./repositoryCarousel";
import { SearchBar } from "./searchBar";


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
        return <span className="font-mono">
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
            <span className="font-mono text-sm">
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
