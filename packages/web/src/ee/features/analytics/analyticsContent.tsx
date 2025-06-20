"use client"

import { ChartTooltip } from "@/components/ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Users, LucideIcon, Search, ArrowRight, Activity, DollarSign } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AnalyticsChartProps {
    data: AnalyticsResponse
    title: string
    icon: LucideIcon
    period: "day" | "week" | "month"
    dataKey: "code_searches" | "navigations" | "active_users"
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

interface SavingsChartProps {
    data: AnalyticsResponse
    title: string
    icon: LucideIcon
    period: "day" | "week" | "month"
    color: string
    gradientId: string
    avgMinutesSaved: number
    avgSalary: number
}

function SavingsChart({ data, title, icon: Icon, period, color, gradientId, avgMinutesSaved, avgSalary }: SavingsChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    const savingsData = useMemo(() => {
        return data.map(row => {
            const totalOperations = row.code_searches + row.navigations
            const totalMinutesSaved = totalOperations * avgMinutesSaved
            const hourlyRate = avgSalary / (40 * 52) // Assuming 40 hours per week, 52 weeks per year
            const hourlySavings = totalMinutesSaved / 60 * hourlyRate
            
            return {
                ...row,
                savings: Math.round(hourlySavings * 100) / 100 // Round to 2 decimal places
            }
        })
    }, [data, avgMinutesSaved, avgSalary])

    const chartConfig = {
        savings: {
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
                        <AreaChart data={savingsData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                                    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                                    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
                                    return `$${value.toFixed(0)}`
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
                                                        <span className="text-popover-foreground font-semibold">${entry.value?.toLocaleString()}</span>
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
                                dataKey="savings"
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
        <div className="space-y-8">
            {[1, 2, 3].map((groupIndex) => (
                <div key={groupIndex} className="space-y-4">
                    {/* Full-width chart skeleton */}
                    <Card className="bg-card border-border shadow-lg">
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
                    
                    {/* Side-by-side charts skeleton */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2].map((chartIndex) => (
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
                </div>
            ))}
        </div>
    )
}

export function AnalyticsContent() {
    const domain = useDomain()
    const { theme } = useTheme()
    
    // Store these values as strings in the state to allow us to have empty fields for better UX
    const [avgMinutesSaved, setAvgMinutesSaved] = useState("2")
    const [avgSalary, setAvgSalary] = useState("100000")
    const numericAvgMinutesSaved = parseFloat(avgMinutesSaved) || 0
    const numericAvgSalary = parseInt(avgSalary, 10) || 0

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
        savings: {
            light: "#10b981",
            dark: "#34d399",
        },
    }), [])

    const getColor = (colorKey: keyof typeof chartColors) => {
        return theme === "dark" ? chartColors[colorKey].dark : chartColors[colorKey].light
    }

    const totalSavings = useMemo(() => {
        if (!analyticsResponse) return 0
        const totalOperations = analyticsResponse.reduce((sum, row) => sum + row.code_searches + row.navigations, 0)
        const totalMinutesSaved = totalOperations * numericAvgMinutesSaved
        const hourlyRate = numericAvgSalary / (40 * 52)
        return Math.round((totalMinutesSaved / 60 * hourlyRate) * 100) / 100
    }, [analyticsResponse, numericAvgMinutesSaved, numericAvgSalary])

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

    const dailyData = analyticsResponse.filter((row) => row.period === "day")
    const weeklyData = analyticsResponse.filter((row) => row.period === "week")
    const monthlyData = analyticsResponse.filter((row) => row.period === "month")

    const chartGroups = [
        {
            title: "Active Users",
            icon: Users,
            color: getColor("users"),
            charts: [
                {
                    title: "Daily Active Users",
                    data: dailyData,
                    dataKey: "active_users" as const,
                    gradientId: "dailyUsers",
                    fullWidth: true,
                },
                {
                    title: "Weekly Active Users",
                    data: weeklyData,
                    dataKey: "active_users" as const,
                    gradientId: "weeklyUsers",
                    fullWidth: false,
                },
                {
                    title: "Monthly Active Users",
                    data: monthlyData,
                    dataKey: "active_users" as const,
                    gradientId: "monthlyUsers",
                    fullWidth: false,
                },
            ],
        },
        {
            title: "Code Searches",
            icon: Search,
            color: getColor("searches"),
            charts: [
                {
                    title: "Daily Code Searches",
                    data: dailyData,
                    dataKey: "code_searches" as const,
                    gradientId: "dailyCodeSearches",
                    fullWidth: true,
                },
                {
                    title: "Weekly Code Searches",
                    data: weeklyData,
                    dataKey: "code_searches" as const,
                    gradientId: "weeklyCodeSearches",
                    fullWidth: false,
                },
                {
                    title: "Monthly Code Searches",
                    data: monthlyData,
                    dataKey: "code_searches" as const,
                    gradientId: "monthlyCodeSearches",
                    fullWidth: false,
                },
            ],
        },
        {
            title: "Navigations",
            icon: ArrowRight,
            color: getColor("navigations"),
            charts: [
                {
                    title: "Daily Navigations",
                    data: dailyData,
                    dataKey: "navigations" as const,
                    gradientId: "dailyNavigations",
                    fullWidth: true,
                },
                {
                    title: "Weekly Navigations",
                    data: weeklyData,
                    dataKey: "navigations" as const,
                    gradientId: "weeklyNavigations",
                    fullWidth: false,
                },
                {
                    title: "Monthly Navigations",
                    data: monthlyData,
                    dataKey: "navigations" as const,
                    gradientId: "monthlyNavigations",
                    fullWidth: false,
                },
            ],
        },
    ]

    return (
        <div className="space-y-8">
            {chartGroups.map((group) => (
                <div key={group.title} className="space-y-4">
                    {group.charts
                        .filter(chart => chart.fullWidth)
                        .map((chart) => (
                            <div key={chart.title} className="w-full">
                                <AnalyticsChart
                                    data={chart.data}
                                    title={chart.title}
                                    icon={group.icon}
                                    period={chart.data[0]?.period as "day" | "week" | "month"}
                                    dataKey={chart.dataKey}
                                    color={group.color}
                                    gradientId={chart.gradientId}
                                />
                            </div>
                        ))}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {group.charts
                            .filter(chart => !chart.fullWidth)
                            .map((chart) => (
                                <AnalyticsChart
                                    key={chart.title}
                                    data={chart.data}
                                    title={chart.title}
                                    icon={group.icon}
                                    period={chart.data[0]?.period as "day" | "week" | "month"}
                                    dataKey={chart.dataKey}
                                    color={group.color}
                                    gradientId={chart.gradientId}
                                />
                            ))}
                    </div>
                </div>
            ))}

            <div className="space-y-6">
                <Card className="bg-card border-border shadow-lg">
                    <CardHeader>
                        <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-lg bg-muted/50">
                                <DollarSign className="h-5 w-5" style={{ color: getColor("savings") }} />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-semibold text-card-foreground">Savings Calculator</CardTitle>
                                <p className="text-muted-foreground text-sm">Calculate the monetary value of time saved using Sourcebot</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-2">
                                <Label htmlFor="avgMinutesSaved">Average Minutes Saved Per Operation</Label>
                                <Input
                                    id="avgMinutesSaved"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={avgMinutesSaved}
                                    onChange={(e) => setAvgMinutesSaved(e.target.value)}
                                    placeholder="2"
                                />
                                <p className="text-xs text-muted-foreground">Estimated time saved per search or navigation operation</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="avgSalary">Average Annual Salary ($)</Label>
                                <Input
                                    id="avgSalary"
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={avgSalary}
                                    onChange={(e) => setAvgSalary(e.target.value)}
                                    placeholder="100000"
                                />
                                <p className="text-xs text-muted-foreground">Average annual salary of your engineering team</p>
                            </div>
                        </div>
                        
                        <Card className="bg-muted/30 border-border/50">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-2">Total Estimated Savings</p>
                                    <p className="text-3xl font-bold text-card-foreground">${totalSavings.toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Based on {analyticsResponse.reduce((sum, row) => sum + row.code_searches + row.navigations, 0).toLocaleString()} total operations
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <SavingsChart
                        data={dailyData}
                        title="Daily Savings"
                        icon={DollarSign}
                        period="day"
                        color={getColor("savings")}
                        gradientId="dailySavings"
                        avgMinutesSaved={numericAvgMinutesSaved}
                        avgSalary={numericAvgSalary}
                    />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SavingsChart
                            data={weeklyData}
                            title="Weekly Savings"
                            icon={DollarSign}
                            period="week"
                            color={getColor("savings")}
                            gradientId="weeklySavings"
                            avgMinutesSaved={numericAvgMinutesSaved}
                            avgSalary={numericAvgSalary}
                        />
                        <SavingsChart
                            data={monthlyData}
                            title="Monthly Savings"
                            icon={DollarSign}
                            period="month"
                            color={getColor("savings")}
                            gradientId="monthlySavings"
                            avgMinutesSaved={numericAvgMinutesSaved}
                            avgSalary={numericAvgSalary}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}