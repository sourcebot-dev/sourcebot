import { getRepos } from "@/actions";
import { Footer } from "@/app/components/footer";
import { getOrgFromDomain } from "@/data/org";
import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { Homepage } from "./components/homepage";
import { NavigationMenu } from "./components/navigationMenu";
import { PageNotFound } from "./components/pageNotFound";
import { UpgradeToast } from "./components/upgradeToast";
import { isServiceError } from "@/lib/utils";

export default async function Home({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    const repos = await getRepos(domain);
    const modelProviderInfo = getConfiguredModelProviderInfo();

    return (
        <div className="flex flex-col items-center overflow-hidden min-h-screen">
            <NavigationMenu
                domain={domain}
            />
            <UpgradeToast />

            <Homepage
                initialRepos={isServiceError(repos) ? [] : repos}
                modelProviderInfo={modelProviderInfo}
            />
            <Footer />
        </div>
    )
}
