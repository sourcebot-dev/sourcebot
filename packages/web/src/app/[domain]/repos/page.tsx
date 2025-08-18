import { RepositoryTable } from "./repositoryTable";
import { getOrgFromDomain } from "@/data/org";
import { PageNotFound } from "../components/pageNotFound";
import { Header } from "../components/header";
import { env } from "@/env.mjs";

export default async function ReposPage({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }

    return (
        <div>
            <Header>
                <h1 className="text-3xl">Repositories</h1>
            </Header>
            <div className="flex flex-col items-center">
                <div className="w-full">
                    <RepositoryTable
                        isAddReposButtonVisible={env.EXPERIMENT_SELF_SERVE_REPO_INDEXING_ENABLED === 'true'}
                    />
                </div>
            </div>
        </div>
    )
}
