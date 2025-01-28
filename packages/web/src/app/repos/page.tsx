import { Suspense } from "react";
import { NavigationMenu } from "../components/navigationMenu";
import { RepositoryTable } from "./repositoryTable";
import { getCurrentUserOrg } from "@/auth";
import { isServiceError } from "@/lib/utils";

export default async function ReposPage() {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return (
            <>
                Error: {orgId.message}
            </>
        )
    }
    
    return (
        <div className="h-screen flex flex-col items-center">
            <NavigationMenu />
            <Suspense fallback={<div>Loading...</div>}>
                <div className="max-w-[90%]">
                    <RepositoryTable orgId={ orgId }/>
                </div>
            </Suspense>
        </div>
    )
}