import { NotFound } from "@/app/[domain]/components/notFound"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ConnectionIcon } from "../components/connectionIcon"
import { Header } from "../../components/header"
import { RepoList } from "./components/repoList"
import { getConnectionByDomain } from "@/data/connection"
import { Overview } from "./components/overview"

interface ConnectionManagementPageProps {
    params: Promise<{
        domain: string
        id: string
    }>,
}

export default async function ConnectionManagementPage(props: ConnectionManagementPageProps) {
    const params = await props.params;
    const connection = await getConnectionByDomain(Number(params.id), params.domain);
    if (!connection) {
        return <NotFound className="flex w-full h-full items-center justify-center" message="Connection not found" />
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <Breadcrumb className="mb-6">
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={`/${params.domain}/connections`}>Connections</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem>
                                <BreadcrumbPage>{connection.name}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="flex items-center gap-3">
                        <ConnectionIcon type={connection.connectionType} />
                        <h1 className="text-2xl font-semibold text-foreground">{connection.name}</h1>
                    </div>
                </div>
                
                <div className="border-t border-border/40 pt-8">
                    <div className="space-y-12">
                        <div>
                            <h2 className="text-lg font-medium text-foreground mb-6">Overview</h2>
                            <Overview connectionId={connection.id} />
                        </div>

                        <div>
                            <h2 className="text-lg font-medium text-foreground mb-6">Linked Repositories</h2>
                            <RepoList connectionId={connection.id} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
