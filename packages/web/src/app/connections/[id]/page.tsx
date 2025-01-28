import { getCurrentUserOrg } from "@/auth";
import { Header } from "../components/header"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
  } from "@/components/ui/breadcrumb"
import { isServiceError } from "@/lib/utils";
import { getConnection } from "@/data/connection";
import { NotFound } from "@/app/components/notFound";
import { ConnectionIcon } from "../components/connectionIcon";

export default async function ConnectionManagementPage({ params }: { params: { id: string } }) {
    const orgId = await getCurrentUserOrg();
    if (isServiceError(orgId)) {
        return (
            <>
                Error: {orgId.message}
            </>
        )
    }

    const connectionId = Number(params.id);
    if (isNaN(connectionId)) {
        return (
            <NotFound
                className="flex w-full h-full items-center justify-center"
                message="Connection not found"
            />
        )
    }
    
    const connection = await getConnection(Number(params.id), orgId);
    if (!connection) {
        return (
            <NotFound
                className="flex w-full h-full items-center justify-center"
                message="Connection not found"
            />
        )
    }

    return (
        <div>
            <Header>
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/connections">Connections</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{connection.name}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <div className="mt-6 flex flex-row items-center gap-4">
                    <ConnectionIcon
                        type={connection.connectionType}
                    />
                    <h1 className="text-lg font-semibold">{connection.name}</h1>
                </div>
            </Header>
        </div>
    )
}