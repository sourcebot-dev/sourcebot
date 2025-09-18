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
        <div>
            <Header>
                <Breadcrumb>
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
                <div className="mt-6 flex items-center gap-3">
                    <ConnectionIcon type={connection.connectionType} />
                    <h1 className="text-3xl font-semibold">{connection.name}</h1>
                </div>
            </Header>
            
            <div className="space-y-8">
                <div>
                    <h2 className="text-lg font-medium mb-4">Overview</h2>
                    <Overview connectionId={connection.id} />
                </div>

                <div>
                    <h2 className="text-lg font-medium mb-4">Linked Repositories</h2>
                    <RepoList connectionId={connection.id} />
                </div>
            </div>
        </div>
    )
}
