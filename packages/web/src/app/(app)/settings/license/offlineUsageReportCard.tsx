'use client';

import { useCallback } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MonthlyUsage } from "@/features/billing/seatUsageReport";
import { SettingsCard } from "../components/settingsCard";

const DOCS_URL = "https://docs.sourcebot.dev/docs/seat-reconciliation";
const REPORT_EMAIL = "ar@sourcebot.dev";

interface OfflineUsageReportCardProps {
    licenseId: string;
    // ISO 8601 subscription start date.
    startDate: string;
    months: MonthlyUsage[];
}

export function OfflineUsageReportCard({ licenseId, startDate, months }: OfflineUsageReportCardProps) {
    // Most recent first; the in-progress Month (if any) sits at the top.
    const rows = [...months].reverse();
    const completedMonths = months.filter((m) => m.isComplete);

    const handleExport = useCallback(() => {
        const report = {
            licenseId,
            startDate,
            // Only completed Months are reportable; an in-progress Month's peak
            // can still rise before the Month closes.
            months: completedMonths.map((m) => ({
                monthNumber: m.monthNumber,
                windowStart: m.windowStart.toISOString(),
                windowEnd: m.windowEnd.toISOString(),
                peakProvisioned: m.peakProvisioned,
                peakAt: m.peakAt.toISOString(),
            })),
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `sourcebot-usage-${licenseId}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }, [licenseId, startDate, completedMonths]);

    return (
        <div className="flex flex-col gap-3">
            <div>
                <h3 className="text-lg font-medium">Usage</h3>
                <p className="text-sm text-muted-foreground">
                    The greatest number of users provisioned during each subscription month.
                    Within five business days of each month&apos;s end, send the report to{" "}
                    <a href={`mailto:${REPORT_EMAIL}`} className="text-link hover:underline">
                        {REPORT_EMAIL}
                    </a>{" "}
                    for reconciliation.{" "}
                    <a
                        href={DOCS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                    >
                        Learn more
                    </a>
                </p>
            </div>
            <SettingsCard>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={completedMonths.length === 0}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Export report
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead className="text-right">Peak users</TableHead>
                                <TableHead className="text-right">Reached</TableHead>
                                <TableHead className="text-right">At month end</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((month) => (
                                <TableRow key={month.monthNumber}>
                                    <TableCell className="flex items-center gap-2">
                                        {formatWindow(month.windowStart, month.windowEnd)}
                                        {!month.isComplete && (
                                            <Badge variant="outline" className="text-muted-foreground">
                                                In progress
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {month.peakProvisioned}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {formatDate(month.peakAt)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {month.endProvisioned}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </SettingsCard>
        </div>
    );
}

// Month boundaries are UTC instants, so format in UTC to avoid the local
// timezone shifting the displayed day across a midnight boundary.
function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

// The window is half-open [start, end); display the inclusive last day.
function formatWindow(start: Date, end: Date): string {
    const inclusiveEnd = new Date(end.getTime() - 1);
    return `${formatDate(start)} – ${formatDate(inclusiveEnd)}`;
}
