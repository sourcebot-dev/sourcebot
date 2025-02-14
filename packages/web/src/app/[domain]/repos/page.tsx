import { Suspense } from "react";
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
            <Suspense fallback={<div>Loading...</div>}>
                <div className="max-w-[90%]">
                    <RepositoryTable orgId={ org.id }/>
                </div>
            </Suspense>
        </div>
    )
}