import { NotFound } from "@/app/[domain]/components/notFound"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { TabSwitcher } from "@/components/ui/tab-switcher"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ConnectionIcon } from "../components/connectionIcon"
import { Header } from "../../components/header"
import { ConfigSetting } from "./components/configSetting"
import { DeleteConnectionSetting } from "./components/deleteConnectionSetting"
import { DisplayNameSetting } from "./components/displayNameSetting"
import { RepoList } from "./components/repoList"
import { auth } from "@/auth"
import { getConnectionByDomain } from "@/data/connection"
import { Overview } from "./components/overview"

interface ConnectionManagementPageProps {
    params: {
        domain: string
        id: string
    },
    searchParams: {
        tab: string
    }
}

export default async function ConnectionManagementPage({ params, searchParams }: ConnectionManagementPageProps) {
    const session = await auth();
    if (!session) {
        return null;
    }

    const connection = await getConnectionByDomain(Number(params.id), params.domain);
    if (!connection) {
        return <NotFound className="flex w-full h-full items-center justify-center" message="Connection not found" />
    }

    const currentTab = searchParams.tab || "overview";


    return (
        <Tabs value={currentTab} className="w-full">
            <Header className="mb-6" withTopMargin={false}>
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
                <div className="mt-6 flex flex-row items-center gap-4 w-full">
                    <ConnectionIcon type={connection.connectionType} />
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
            <TabsContent
                value="overview"
                className="space-y-8"
            >
                <div>
                    <h1 className="font-semibold text-lg mb-4">Overview</h1>
                    <Overview connectionId={connection.id} />
                </div>

                <div>
                    <h1 className="font-semibold text-lg mb-4">Linked Repositories</h1>
                    <RepoList connectionId={connection.id} />
                </div>
            </TabsContent>
            <TabsContent
                value="settings"
                className="flex flex-col gap-6"
            >
                <DisplayNameSetting connectionId={connection.id} name={connection.name} />
                <ConfigSetting
                    connectionId={connection.id}
                    type={connection.connectionType}
                    config={JSON.stringify(connection.config, null, 2)}
                />
                <DeleteConnectionSetting connectionId={connection.id} />
            </TabsContent>
        </Tabs>
    )
}
