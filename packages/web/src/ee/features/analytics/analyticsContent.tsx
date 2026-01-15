"use client"

import { ChartTooltip } from "@/components/ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Users, LucideIcon, Search, ArrowRight, Activity, Calendar, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { useQuery } from "@tanstack/react-query"
import { useDomain } from "@/hooks/useDomain"
import { unwrapServiceError } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsResponse } from "./types"
import { getAnalytics } from "./actions"
import { useTheme } from "next-themes"
import { useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type TimePeriod = "day" | "week" | "month"

const periodLabels: Record<TimePeriod, string> = {
    day: "Daily",
    week: "Weekly",
    month: "Monthly",
}

interface AnalyticsChartProps {
    data: AnalyticsResponse
    title: string
    icon: LucideIcon
    period: "day" | "week" | "month"
    dataKey: "code_searches" | "navigations" | "ask_chats" | "active_users"
    color: string
    gradientId: string
}

function AnalyticsChart({ data, title, icon: Icon, period, dataKey, color, gradientId }: AnalyticsChartProps) {
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
                        <div>
                            <CardTitle className="text-lg font-semibold text-card-foreground">{title}</CardTitle>
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

            {/* Chart skeletons */}
            {[1, 2, 3, 4].map((chartIndex) => (
                <Card key={chartIndex} className="bg-card border-border shadow-lg">
                    <CardHeader className="pb-4">
                        <div className="flex items-center space-x-3">
                            <Skeleton className="h-9 w-9 rounded-lg bg-muted" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-32 bg-muted" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Skeleton className="h-[240px] w-full bg-muted rounded-lg" />
                    </CardContent>
                </Card>
            ))}
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
        users: {
            light: "#3b82f6",
            dark: "#60a5fa",
        },
        searches: {
            light: "#f59e0b", 
            dark: "#fbbf24",
        },
        navigations: {
            light: "#ef4444",
            dark: "#f87171",
        },
        askChats: {
            light: "#8b5cf6",
            dark: "#a78bfa",
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

    const periodData = analyticsResponse.filter((row) => row.period === selectedPeriod)

    const charts = [
        {
            title: `${periodLabels[selectedPeriod]} Active Users`,
            icon: Users,
            color: getColor("users"),
            dataKey: "active_users" as const,
            gradientId: "activeUsers",
        },
        {
            title: `${periodLabels[selectedPeriod]} Code Searches`,
            icon: Search,
            color: getColor("searches"),
            dataKey: "code_searches" as const,
            gradientId: "codeSearches",
        },
        {
            title: `${periodLabels[selectedPeriod]} Navigations`,
            icon: ArrowRight,
            color: getColor("navigations"),
            dataKey: "navigations" as const,
            gradientId: "navigations",
        },
        {
            title: `${periodLabels[selectedPeriod]} Ask Chats`,
            icon: MessageCircle,
            color: getColor("askChats"),
            dataKey: "ask_chats" as const,
            gradientId: "askChats",
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

            {/* Analytics Charts */}
            {charts.map((chart) => (
                <AnalyticsChart
                    key={chart.dataKey}
                    data={periodData}
                    title={chart.title}
                    icon={chart.icon}
                    period={selectedPeriod}
                    dataKey={chart.dataKey}
                    color={chart.color}
                    gradientId={chart.gradientId}
                />
            ))}
        </div>
    )
}