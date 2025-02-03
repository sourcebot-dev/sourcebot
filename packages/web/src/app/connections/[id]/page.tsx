import { NotFound } from "@/app/components/notFound";
import { getCurrentUserOrg } from "@/auth";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { getConnection, getLinkedRepos } from "@/data/connection";
import { isServiceError } from "@/lib/utils";
import { ConnectionIcon } from "../components/connectionIcon";
import { Header } from "../components/header";
import { DisplayNameSetting } from "./components/displayNameSetting";
import { ConfigSetting } from "./components/configSetting";
import { DeleteConnectionSetting } from "./components/deleteConnectionSetting";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import Image from "next/image";

interface ConnectionManagementPageProps {
    params: {
        id: string;
    },
    searchParams: {
        tab?: string;
    }
}

export default async function ConnectionManagementPage({
    params,
    searchParams,
}: ConnectionManagementPageProps) {
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

    const linkedRepos = await getLinkedRepos(connectionId, orgId);

    const currentTab = searchParams.tab || "overview";

    return (
        <Tabs
            value={currentTab}
            className="w-full"
        >
            <Header
                className="mb-6"
                withTopMargin={false}
            >
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
                <TabSwitcher
                    className="h-auto p-0 bg-transparent border-b border-border mt-6"
                    tabs={[
                        { label: "Overview", value: "overview" },
                        { label: "Settings", value: "settings" },
                    ]}
                    currentTab={currentTab}
                />
            </Header>
            <TabsContent value="overview">
                <h1 className="font-semibold text-lg">Linked Repositories</h1>
                {linkedRepos.map(({ repo }, index) => (
                    <div key={index}>
                        <Image
                            src={repo.imageUrl ?? ""}
                            alt={repo.name}
                            width={40}
                            height={40}
                            className="rounded-full"
                        />
                        <p>{repo.name} | {repo.repoIndexingStatus}</p>
                    </div>
                ))}
            </TabsContent>
            <TabsContent
                value="settings"
                className="flex flex-col gap-6"
            >
                <DisplayNameSetting
                    connectionId={connection.id}
                    name={connection.name}
                />
                <ConfigSetting
                    connectionId={connection.id}
                    type={connection.connectionType}
                    config={JSON.stringify(connection.config, null, 2)}
                />
                <DeleteConnectionSetting
                    connectionId={connection.id}
                />
            </TabsContent>
        </Tabs>

    )
}
