import { NotFound } from "@/app/[domain]/components/notFound";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabSwitcher } from "@/components/ui/tab-switcher";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { getConnection, getLinkedRepos } from "@/data/connection";
import { ConnectionIcon } from "../components/connectionIcon";
import { Header } from "../../components/header";
import { ConfigSetting } from "./components/configSetting";
import { DeleteConnectionSetting } from "./components/deleteConnectionSetting";
import { DisplayNameSetting } from "./components/displayNameSetting";
import { RepoListItem } from "./components/repoListItem";
import { getOrgFromDomain } from "@/data/org";
import { PageNotFound } from "../../components/pageNotFound";

interface ConnectionManagementPageProps {
    params: {
        id: string;
        domain: string;
    },
    searchParams: {
        tab?: string;
    }
}

export default async function ConnectionManagementPage({
    params,
    searchParams,
}: ConnectionManagementPageProps) {
    const org = await getOrgFromDomain(params.domain);
    if (!org) {
        return <PageNotFound />
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

    const connection = await getConnection(Number(params.id), org.id);
    if (!connection) {
        return (
            <NotFound
                className="flex w-full h-full items-center justify-center"
                message="Connection not found"
            />
        )
    }

    const linkedRepos = await getLinkedRepos(connectionId, org.id);

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
                            <BreadcrumbLink href={`/${params.domain}/connections`}>Connections</BreadcrumbLink>
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
                <h1 className="font-semibold text-lg">Overview</h1>
                <div className="mt-4 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Connection Type</h2>
                            <p className="mt-2 text-sm">{connection.connectionType}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Last Synced At</h2>
                            <p className="mt-2 text-sm">{connection.syncedAt ? new Date(connection.syncedAt).toLocaleDateString() : 'never'}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Linked Repositories</h2>
                            <p className="mt-2 text-sm">{linkedRepos.length}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
                            <p className="mt-2 text-sm">{connection.syncStatus}</p>
                        </div>
                    </div>
                </div>
                <h1 className="font-semibold text-lg mt-8">Linked Repositories</h1>
                <ScrollArea
                    className="mt-4 max-h-96 overflow-scroll"
                >
                    <div className="flex flex-col gap-4">
                        {linkedRepos
                            .sort((a, b) => {
                                const aIndexedAt = a.repo.indexedAt ?? new Date();
                                const bIndexedAt = b.repo.indexedAt ?? new Date();

                                return bIndexedAt.getTime() - aIndexedAt.getTime();
                            })
                            .map(({ repo }) => (
                                <RepoListItem
                                    key={repo.id}
                                    imageUrl={repo.imageUrl ?? undefined}
                                    name={repo.name}
                                    indexedAt={repo.indexedAt ?? undefined}
                                    status={repo.repoIndexingStatus}
                                />
                            ))}
                    </div>
                </ScrollArea>
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
