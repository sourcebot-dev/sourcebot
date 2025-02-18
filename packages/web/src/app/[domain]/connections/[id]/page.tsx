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
import { getConnectionInfoAction, getOrgFromDomainAction, flagConnectionForSync } from "@/actions"
import { isServiceError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ReloadIcon } from "@radix-ui/react-icons"
import { useToast } from "@/components/hooks/use-toast"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DisplayConnectionError } from "./components/connectionError"

export default function ConnectionManagementPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [org, setOrg] = useState<Org | null>(null)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [linkedRepos, setLinkedRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleSecretsNavigation = () => {
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
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
    const intervalId = setInterval(loadData, 1000)
    return () => clearInterval(intervalId)
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
        <div className="mt-6 flex flex-row items-center gap-4">
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
                    <HoverCardTrigger asChild>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={async () => {
                      const result = await flagConnectionForSync(connection.id, params.domain as string)
                      if (isServiceError(result)) {
                        toast({
                          description: `❌ Failed to flag connection for sync. Reason: ${result.message}`,
                        })
                      } else {
                        toast({
                          description: "✅ Connection flagged for sync.",
                        })
                      }
                    }}
                  >
                    <ReloadIcon className="h-4 w-4 mr-2" />
                    Retry Sync
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <h1 className="font-semibold text-lg mt-8">Linked Repositories</h1>
        <ScrollArea className="mt-4 max-h-96 overflow-scroll">
          <div className="flex flex-col gap-4">
            {linkedRepos
              .sort((a, b) => {
                const aIndexedAt = a.indexedAt ?? new Date()
                const bIndexedAt = b.indexedAt ?? new Date()

                return bIndexedAt.getTime() - aIndexedAt.getTime()
              })
              .map((repo) => (
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
      <TabsContent value="settings" className="flex flex-col gap-6">
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
