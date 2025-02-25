"use client"

import { NotFound } from "@/app/[domain]/components/notFound"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TabSwitcher } from "@/components/ui/tab-switcher"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ConnectionIcon } from "../components/connectionIcon"
import { Header } from "../../components/header"
import { ConfigSetting } from "./components/configSetting"
import { DeleteConnectionSetting } from "./components/deleteConnectionSetting"
import { DisplayNameSetting } from "./components/displayNameSetting"
import { RepoListItem } from "./components/repoListItem"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { Connection, Repo, Org } from "@sourcebot/db"
import { getConnectionInfoAction, getOrgFromDomainAction } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DisplayConnectionError } from "./components/connectionError"
import { NotFoundWarning } from "./components/notFoundWarning"
import { RetrySyncButton } from "./components/retrySyncButton"
import { RetryAllFailedReposButton } from "./components/retryAllFailedReposButton"
import useCaptureEvent from "@/hooks/useCaptureEvent";

export default function ConnectionManagementPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const [org, setOrg] = useState<Org | null>(null)
    const [connection, setConnection] = useState<Connection | null>(null)
    const [linkedRepos, setLinkedRepos] = useState<Repo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const captureEvent = useCaptureEvent();

    const handleSecretsNavigation = () => {
        captureEvent('wa_connection_secrets_navigation_pressed', {});
        router.push(`/${params.domain}/secrets`)
    }

    useEffect(() => {
        const loadData = async () => {
            try {
                const orgResult = await getOrgFromDomainAction(params.domain as string)
                if (isServiceError(orgResult)) {
                    setError(orgResult.message)
                    setLoading(false)
                    return
                }
                setOrg(orgResult)

                const connectionId = Number(params.id)
                if (isNaN(connectionId)) {
                    setError("Invalid connection ID")
                    setLoading(false)
                    return
                }

                const connectionInfoResult = await getConnectionInfoAction(connectionId, params.domain as string)
                if (isServiceError(connectionInfoResult)) {
                    setError(connectionInfoResult.message)
                    setLoading(false)
                    return
                }

                connectionInfoResult.linkedRepos.sort((a, b) => {
                    // Helper function to get priority of indexing status
                    const getPriority = (status: string) => {
                        switch (status) {
                            case "FAILED":
                                return 0
                            case "IN_INDEX_QUEUE":
                            case "INDEXING":
                                return 1
                            case "INDEXED":
                                return 2
                            default:
                                return 3
                        }
                    }

                    const priorityA = getPriority(a.repoIndexingStatus)
                    const priorityB = getPriority(b.repoIndexingStatus)

                    // First sort by priority
                    if (priorityA !== priorityB) {
                        return priorityA - priorityB
                    }

                    // If same priority, sort by createdAt
                    return new Date(a.indexedAt ?? new Date()).getTime() - new Date(b.indexedAt ?? new Date()).getTime()
                })

                setConnection(connectionInfoResult.connection)
                setLinkedRepos(connectionInfoResult.linkedRepos)
                setLoading(false)
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "An error occurred while loading the connection. If the problem persists, please contact us at team@sourcebot.dev",
                )
                setLoading(false)
            }
        }

        loadData()
    }, [params.domain, params.id])

    if (loading) {
        return <div>Loading...</div>
    }

    if (error || !org || !connection) {
        return <NotFound className="flex w-full h-full items-center justify-center" message={error || "Not found"} />
    }

    const currentTab = searchParams.get("tab") || "overview"

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
            >
                <h1 className="font-semibold text-lg">Overview</h1>
                <div className="mt-4 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Connection Type</h2>
                            <p className="mt-2 text-sm">{connection.connectionType}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Last Synced At</h2>
                            <p className="mt-2 text-sm">
                                {connection.syncedAt ? new Date(connection.syncedAt).toLocaleDateString() : "never"}
                            </p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Linked Repositories</h2>
                            <p className="mt-2 text-sm">{linkedRepos.length}</p>
                        </div>
                        <div className="rounded-lg border border-border p-4 bg-background">
                            <h2 className="text-sm font-medium text-muted-foreground">Status</h2>
                            <div className="flex items-center gap-2 mt-2">
                                {connection.syncStatus === "FAILED" ? (
                                    <HoverCard openDelay={50}>
                                        <HoverCardTrigger asChild onMouseEnter={() => captureEvent('wa_connection_failed_status_hover', {})}>
                                            <div className="flex items-center">
                                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-600/20 cursor-help hover:text-red-600 hover:bg-red-100 transition-colors duration-200">
                                                    {connection.syncStatus}
                                                </span>
                                            </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-80">
                                            <DisplayConnectionError
                                                syncStatusMetadata={connection.syncStatusMetadata}
                                                onSecretsClick={handleSecretsNavigation}
                                            />
                                        </HoverCardContent>
                                    </HoverCard>
                                ) : (
                                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                        {connection.syncStatus}
                                    </span>
                                )}
                                {connection.syncStatus === "FAILED" && (
                                    <RetrySyncButton connectionId={connection.id} domain={params.domain as string} />
                                )}
                            </div>
                        </div>
                    </div>
                    <NotFoundWarning syncStatusMetadata={connection.syncStatusMetadata} onSecretsClick={handleSecretsNavigation} connectionId={connection.id} connectionType={connection.connectionType} domain={params.domain as string} />
                </div>
                <div className="flex justify-between items-center mt-8">
                    <h1 className="font-semibold text-lg">Linked Repositories</h1>
                    <RetryAllFailedReposButton connectionId={connection.id} domain={params.domain as string} />
                </div>
                <ScrollArea className="mt-4 max-h-96 overflow-scroll">
                    <div className="flex flex-col gap-4">
                        {linkedRepos.map((repo) => (
                            <RepoListItem
                                key={repo.id}
                                imageUrl={repo.imageUrl ?? undefined}
                                name={repo.name}
                                indexedAt={repo.indexedAt ?? undefined}
                                status={repo.repoIndexingStatus}
                                repoId={repo.id}
                                domain={params.domain as string}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </TabsContent>
            <TabsContent
                value="settings"
                // @note: There was some bugginess with the ConfigEditor ref not being set again
                // after the parent component was unmounted and remounted. This workarouns makes it
                // s.t., hide the settings tab when it is inactive, instead of unmounting it.
                // @see: https://github.com/radix-ui/primitives/issues/2359#issuecomment-2481321719
                className="flex flex-col gap-6 data-[state=inactive]:hidden"
                forceMount={true}
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
