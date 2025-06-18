"use client"

import { ChartTooltip } from "@/components/ui/chart"
import { Area, AreaChart, XAxis, YAxis } from "recharts"
import { Users, LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { useQuery } from "@tanstack/react-query"
import { useDomain } from "@/hooks/useDomain"
import { unwrapServiceError } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsResponse } from "./types"
import { getAnalytics } from "./actions"

interface AnalyticsChartProps {
    data: AnalyticsResponse
    title: string
    icon: LucideIcon
    latestValue: number
    changePercent: number
}

function AnalyticsChart({ data, title, icon: Icon, latestValue, changePercent }: AnalyticsChartProps) {
    const chartConfig = {
        dau: {
            label: title,
            color: `hsl(var(--chart-1))`,
        },
    }

    const colorVar = `var(--color-dau)`

    return (
        <Card className="bg-slate-900 border-slate-800 w-full">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-white">{title}</CardTitle>
                    <Icon className="h-5 w-5 text-slate-400" />
                </div>
                <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-white">{latestValue.toLocaleString()}</span>
                    <span className={`text-sm ${changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {changePercent >= 0 ? "+" : ""}
                        {changePercent.toFixed(1)}%
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} width={undefined} height={200}>
                        <defs>
                            <linearGradient id="colorDAU" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colorVar} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={colorVar} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                            tickFormatter={(value) => {
                                const date = new Date(value)
                                return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <ChartTooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                                            <p className="text-slate-300 text-sm mb-2">
                                                {new Date(label).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </p>
                                            {payload.map((entry, index) => (
                                                <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                                                    {title}: {entry.value?.toLocaleString()}
                                                </p>
                                            ))}
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="dau"
                            stroke={colorVar}
                            fillOpacity={1}
                            fill="url(#colorDAU)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

export function AnalyticsContent() {
    const domain = useDomain()

    const { data: analyticsResponse, isLoading, error } = useQuery({
        queryKey: ['analytics', domain],
        queryFn: () => unwrapServiceError(getAnalytics(domain)),
    })

    if (isLoading) {
        return (
            <div className="w-full">
                {[1].map((i) => (
                    <Card key={i} className="bg-slate-900 border-slate-800 w-full">
                        <CardHeader className="pb-2">
                            <Skeleton className="h-6 w-32 bg-slate-800" />
                            <Skeleton className="h-8 w-24 bg-slate-800" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[200px] w-full bg-slate-800" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-red-400">Error loading analytics: {error.message}</p>
            </div>
        )
    }

    if (!analyticsResponse) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-slate-400">No analytics data available</p>
            </div>
        )
    }

    const data = analyticsResponse

    // Calculate summary stats
    const latestData = data[data.length - 1]
    const previousData = data[data.length - 2]

    const dauChange = latestData && previousData ? ((latestData.dau - previousData.dau) / previousData.dau) * 100 : 0

    const chartConfigs = [
        {
            title: 'Daily Active Users',
            icon: Users,
            latestValue: latestData?.dau || 0,
            changePercent: dauChange,
        },
    ]

    return (
        <div className="w-full">
            {chartConfigs.map((config, index) => (
                <AnalyticsChart
                    key={index}
                    data={data}
                    title={config.title}
                    icon={config.icon}
                    latestValue={config.latestValue}
                    changePercent={config.changePercent}
                />
            ))}
        </div>
    )
} 