import { NavigationMenu } from "../components/navigationMenu";
import { RepositoryTable } from "./repositoryTable";
import { getOrgFromDomain } from "@/data/org";
import { PageNotFound } from "../components/pageNotFound";

export default async function ReposPage({ params: { domain } }: { params: { domain: string } }) {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return <PageNotFound />
    }
    
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu domain={domain} />
            <div className="w-[75%]">
                <RepositoryTable />
            </div>
        </div>
    )
}
