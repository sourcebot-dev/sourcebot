"use client"

import { ChartTooltip } from "@/components/ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Users, LucideIcon, Search, ArrowRight, Activity, Calendar, MessageCircle, Wrench, Key, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { useQuery } from "@tanstack/react-query"
import { useDomain } from "@/hooks/useDomain"
import { unwrapServiceError } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsRow } from "./types"
import { getAnalytics } from "./actions"
import { useTheme } from "next-themes"
import { useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type TimePeriod = "day" | "week" | "month"

const periodLabels: Record<TimePeriod, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
}

interface ChartDefinition {
    title: string
    icon: LucideIcon
    color: string
    dataKey: keyof Omit<AnalyticsRow, 'period' | 'bucket'>
    gradientId: string
    description: string
}

interface AnalyticsChartProps {
    data: AnalyticsRow[]
    title: string
    icon: LucideIcon
    period: "day" | "week" | "month"
    dataKey: keyof Omit<AnalyticsRow, 'period' | 'bucket'>
    color: string
    gradientId: string
    description: string
}

function AnalyticsChart({ data, title, icon: Icon, period, dataKey, color, gradientId, description }: AnalyticsChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    const chartConfig = {
        [dataKey]: {
            label: title,
            theme: {
                light: color,
                dark: color,
            },
        },
    }

    return (
        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-border/80">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div
                            className={`p-2 rounded-lg bg-muted/50`}
                        >
                            <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-semibold text-card-foreground">{title}</CardTitle>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    {description}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                                    <stop offset="50%" stopColor={color} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="bucket"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                                tickFormatter={(value) => {
                                    const utcDate = new Date(value)
                                    const displayDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())

                                    const opts: Intl.DateTimeFormatOptions =
                                        period === "day" || period === "week"
                                            ? { month: "short", day: "numeric" }
                                            : { month: "short", year: "numeric" }
                                    return displayDate.toLocaleDateString("en-US", opts)
                                }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                                tickFormatter={(value) => {
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                    return value.toString()
                                }}
                            />
                            <ChartTooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-2xl">
                                                <p className="text-muted-foreground text-sm mb-2 font-medium">
                                                    {(() => {
                                                        const utcDate = new Date(label)
                                                        const displayDate = new Date(
                                                            utcDate.getUTCFullYear(),
                                                            utcDate.getUTCMonth(),
                                                            utcDate.getUTCDate(),
                                                        )

                                                        const opts: Intl.DateTimeFormatOptions =
                                                            period === "day" || period === "week"
                                                                ? { weekday: "short", month: "long", day: "numeric" }
                                                                : { month: "long", year: "numeric" }
                                                        return displayDate.toLocaleDateString("en-US", opts)
                                                    })()}
                                                </p>
                                                {payload.map((entry, index) => (
                                                    <div key={index} className="flex items-center justify-between space-x-4">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                                            <span className="text-popover-foreground text-sm">{title}</span>
                                                        </div>
                                                        <span className="text-popover-foreground font-semibold">{entry.value?.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                fillOpacity={1}
                                fill={`url(#${gradientId})`}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{
                                    r: 4,
                                    fill: color,
                                    stroke: isDark ? "#1e293b" : "#f8fafc",
                                    strokeWidth: 2,
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

interface MultiLineSeriesDefinition {
    dataKey: keyof Omit<AnalyticsRow, 'period' | 'bucket'>
    label: string
    color: string
    gradientId: string
}

interface MultiLineChartProps {
    data: AnalyticsRow[]
    title: string
    icon: LucideIcon
    period: "day" | "week" | "month"
    series: MultiLineSeriesDefinition[]
    description: string
}

function MultiLineAnalyticsChart({ data, title, icon: Icon, period, series, description }: MultiLineChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    const chartConfig = Object.fromEntries(
        series.map((s) => [s.dataKey, { label: s.label, theme: { light: s.color, dark: s.color } }])
    )

    return (
        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-all duration-300 hover:border-border/80">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-muted/50">
                            <Icon className="h-5 w-5" style={{ color: series[0]?.color }} />
                        </div>
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg font-semibold text-card-foreground">{title}</CardTitle>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    {description}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {series.map((s) => (
                            <div key={s.dataKey} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="text-xs text-muted-foreground">{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                                {series.map((s) => (
                                    <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                                        <stop offset="50%" stopColor={s.color} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <XAxis
                                dataKey="bucket"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                                tickFormatter={(value) => {
                                    const utcDate = new Date(value)
                                    const displayDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
                                    const opts: Intl.DateTimeFormatOptions =
                                        period === "day" || period === "week"
                                            ? { month: "short", day: "numeric" }
                                            : { month: "short", year: "numeric" }
                                    return displayDate.toLocaleDateString("en-US", opts)
                                }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                                tickFormatter={(value) => {
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                    return value.toString()
                                }}
                            />
                            <ChartTooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-xl p-4 shadow-2xl">
                                                <p className="text-muted-foreground text-sm mb-2 font-medium">
                                                    {(() => {
                                                        const utcDate = new Date(label)
                                                        const displayDate = new Date(
                                                            utcDate.getUTCFullYear(),
                                                            utcDate.getUTCMonth(),
                                                            utcDate.getUTCDate(),
                                                        )
                                                        const opts: Intl.DateTimeFormatOptions =
                                                            period === "day" || period === "week"
                                                                ? { weekday: "short", month: "long", day: "numeric" }
                                                                : { month: "long", year: "numeric" }
                                                        return displayDate.toLocaleDateString("en-US", opts)
                                                    })()}
                                                </p>
                                                {payload.map((entry, index) => (
                                                    <div key={index} className="flex items-center justify-between space-x-4">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                                            <span className="text-popover-foreground text-sm">
                                                                {series.find((s) => s.dataKey === entry.dataKey)?.label ?? entry.dataKey}
                                                            </span>
                                                        </div>
                                                        <span className="text-popover-foreground font-semibold">{entry.value?.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }
                                    return null
                                }}
                            />
                            {series.map((s) => (
                                <Area
                                    key={s.dataKey}
                                    type="monotone"
                                    dataKey={s.dataKey}
                                    stroke={s.color}
                                    fillOpacity={1}
                                    fill={`url(#${s.gradientId})`}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{
                                        r: 4,
                                        fill: s.color,
                                        stroke: isDark ? "#1e293b" : "#f8fafc",
                                        strokeWidth: 2,
                                    }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

function ChartSkeletonGroup({ count }: { count: number }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <Card key={i} className="bg-card border-border shadow-lg">
                    <CardHeader className="pb-4">
                        <div className="flex items-center space-x-3">
                            <Skeleton className="h-9 w-9 rounded-lg bg-muted" />
                            <Skeleton className="h-5 w-32 bg-muted" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Skeleton className="h-[240px] w-full bg-muted rounded-lg" />
                    </CardContent>
                </Card>
            ))}
        </>
    )
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            {/* Header skeleton */}
            <div className="flex flex-row items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-6 w-24 bg-muted" />
                    <Skeleton className="h-4 w-64 bg-muted" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 bg-muted" />
                    <Skeleton className="h-10 w-40 bg-muted rounded-md" />
                </div>
            </div>

            {/* Global chart skeleton */}
            <ChartSkeletonGroup count={1} />

            {/* Web App section skeleton */}
            <Skeleton className="h-5 w-24 bg-muted" />
            <ChartSkeletonGroup count={4} />

            {/* API section skeleton */}
            <Skeleton className="h-5 w-16 bg-muted" />
            <ChartSkeletonGroup count={4} />
        </div>
    )
}

export function AnalyticsContent() {
    const domain = useDomain()
    const { theme } = useTheme()

    // Time period selector state
    const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("day")

    const {
        data: analyticsResponse,
        isPending,
        isError,
        error
    } = useQuery({
        queryKey: ["analytics", domain],
        queryFn: () => unwrapServiceError(getAnalytics(domain)),
    })

    const chartColors = useMemo(() => ({
        globalUsers: {
            light: "#6366f1",
            dark: "#818cf8",
        },
        webUsers: {
            light: "#3b82f6",
            dark: "#60a5fa",
        },
        webSearches: {
            light: "#f59e0b",
            dark: "#fbbf24",
        },
        webNavigations: {
            light: "#ef4444",
            dark: "#f87171",
        },
        webAskChats: {
            light: "#8b5cf6",
            dark: "#a78bfa",
        },
        mcpRequests: {
            light: "#10b981",
            dark: "#34d399",
        },
        mcpUsers: {
            light: "#06b6d4",
            dark: "#22d3ee",
        },
        apiRequests: {
            light: "#14b8a6",
            dark: "#2dd4bf",
        },
        apiUsers: {
            light: "#f97316",
            dark: "#fb923c",
        },
    }), [])

    const getColor = (colorKey: keyof typeof chartColors) => {
        return theme === "dark" ? chartColors[colorKey].dark : chartColors[colorKey].light
    }

    if (isPending) {
        return (
            <div className="min-h-screen bg-background p-6">
                <LoadingSkeleton />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="bg-destructive/10 border-destructive/20 p-8">
                    <div className="text-center">
                        <div className="p-3 rounded-full bg-destructive/20 w-fit mx-auto mb-4">
                            <Activity className="h-8 w-8 text-destructive" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Analytics Unavailable</h3>
                        <p className="text-destructive">Error loading analytics: {error.message}</p>
                    </div>
                </Card>
            </div>
        )
    }

    const periodData = analyticsResponse.rows.filter((row) => row.period === selectedPeriod)

    const globalChart: ChartDefinition = {
        title: `${periodLabels[selectedPeriod]} Active Users`,
        icon: Users,
        color: getColor("globalUsers"),
        dataKey: "active_users" as const,
        gradientId: "activeUsers",
        description: "Unique users who performed any tracked action across all sources (web app, MCP, and API). Includes code searches, navigations, Ask chats, file views, and tree browsing. Excludes web repo listings to reduce noise.",
    }

    const webActiveUsersSeries: MultiLineSeriesDefinition[] = [
        {
            dataKey: "web_active_users",
            label: "All",
            color: getColor("webUsers"),
            gradientId: "webActiveUsers",
        },
        {
            dataKey: "web_search_active_users",
            label: "Search",
            color: getColor("webSearches"),
            gradientId: "webSearchActiveUsers",
        },
        {
            dataKey: "web_ask_active_users",
            label: "Ask",
            color: getColor("webAskChats"),
            gradientId: "webAskActiveUsers",
        },
    ]

    const webActivitySeries: MultiLineSeriesDefinition[] = [
        {
            dataKey: "web_code_searches",
            label: "Code Searches",
            color: getColor("webSearches"),
            gradientId: "webCodeSearches",
        },
        {
            dataKey: "web_ask_chats",
            label: "Ask Chats",
            color: getColor("webAskChats"),
            gradientId: "webAskChats",
        },
        {
            dataKey: "web_navigations",
            label: "Navigations",
            color: getColor("webNavigations"),
            gradientId: "webNavigations",
        },
    ]

    const apiActiveUsersSeries: MultiLineSeriesDefinition[] = [
        {
            dataKey: "non_web_active_users",
            label: "Any",
            color: getColor("globalUsers"),
            gradientId: "nonWebActiveUsers",
        },
        {
            dataKey: "mcp_active_users",
            label: "MCP",
            color: getColor("mcpUsers"),
            gradientId: "mcpActiveUsers",
        },
        {
            dataKey: "api_active_users",
            label: "API",
            color: getColor("apiUsers"),
            gradientId: "apiActiveUsers",
        },
    ]

    const apiActivitySeries: MultiLineSeriesDefinition[] = [
        {
            dataKey: "mcp_requests",
            label: "MCP",
            color: getColor("mcpRequests"),
            gradientId: "mcpRequests",
        },
        {
            dataKey: "api_requests",
            label: "API",
            color: getColor("apiRequests"),
            gradientId: "apiRequests",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-row items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                        View usage metrics across your organization.
                    </p>
                    <div className="flex gap-4 mt-1">
                        <p className="text-xs text-muted-foreground/70">
                            Retention period: {analyticsResponse.retentionDays > 0 ? `${analyticsResponse.retentionDays} days` : "Indefinite"}
                        </p>
                        {analyticsResponse.oldestRecordDate && (
                            <p className="text-xs text-muted-foreground/70">
                                Data since: {new Date(analyticsResponse.oldestRecordDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                            </p>
                        )}
                    </div>
                </div>

                {/* Time Period Selector */}
                <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedPeriod} onValueChange={(value: TimePeriod) => setSelectedPeriod(value)}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Daily</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                            <SelectItem value="month">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Global Active Users */}
            <AnalyticsChart
                data={periodData}
                title={globalChart.title}
                icon={globalChart.icon}
                period={selectedPeriod}
                dataKey={globalChart.dataKey}
                color={globalChart.color}
                gradientId={globalChart.gradientId}
                description={globalChart.description}
            />

            {/* Web App Section */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold">Web App</h3>
                    <p className="text-sm text-muted-foreground">
                        Usage from the Sourcebot web interface.
                    </p>
                </div>
                <MultiLineAnalyticsChart
                    data={periodData}
                    title={`${periodLabels[selectedPeriod]} Web Active Users`}
                    icon={Users}
                    period={selectedPeriod}
                    series={webActiveUsersSeries}
                    description="Unique users who interacted with the Sourcebot web interface. All includes users who performed any web action (code searches, navigations, Ask chats, or file views), excluding repo listing. Search and Ask show the subset of users who performed those specific actions."
                />
                <MultiLineAnalyticsChart
                    data={periodData}
                    title={`${periodLabels[selectedPeriod]} Web Activity`}
                    icon={Activity}
                    period={selectedPeriod}
                    series={webActivitySeries}
                    description="Total event counts for web interface activity. Code Searches are searches performed in the web search bar. Ask Chats are conversations created through the web interface. Navigations are go-to-definition and find-references actions in the code viewer."
                />
            </div>

            {/* API Section */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold">API</h3>
                    <p className="text-sm text-muted-foreground">
                        Usage from MCP integrations and direct API access.
                    </p>
                </div>
                <MultiLineAnalyticsChart
                    data={periodData}
                    title={`${periodLabels[selectedPeriod]} API Active Users`}
                    icon={Users}
                    period={selectedPeriod}
                    series={apiActiveUsersSeries}
                    description="Unique users who interacted via MCP integrations or direct API access. Any shows users who used either MCP or API. MCP includes requests from IDE extensions and other MCP clients. API includes direct HTTP API access (e.g., API keys), excluding web app and MCP traffic."
                />
                <MultiLineAnalyticsChart
                    data={periodData}
                    title={`${periodLabels[selectedPeriod]} API Requests`}
                    icon={Activity}
                    period={selectedPeriod}
                    series={apiActivitySeries}
                    description="Total request counts from MCP integrations and direct API access. MCP includes code searches, file reads, tree listings, repo listings, and Ask chats from MCP clients. API includes direct HTTP API requests, excluding web app and MCP traffic."
                />
            </div>
        </div>
    )
}
