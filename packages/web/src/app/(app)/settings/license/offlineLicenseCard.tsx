import type { OfflineLicenseMetadata } from "@sourcebot/shared";
import { Badge } from "@/components/ui/badge";
import { SettingsCard } from "../components/settingsCard";

interface OfflineLicenseCardProps {
    license: OfflineLicenseMetadata;
    isExpired: boolean;
}

export function OfflineLicenseCard({ license, isExpired }: OfflineLicenseCardProps) {
    const expiryDate = new Date(license.expiryDate);
    const truncatedId = license.id.length > 12
        ? `${license.id.slice(0, 8)}…`
        : license.id;

    return (
        <SettingsCard>
            <div className="flex items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">Enterprise plan</p>
                        {isExpired && (
                            <Badge variant="outline" className="border-destructive/30 text-destructive">
                                Expired
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <code className="font-mono">{truncatedId}</code>
                    </div>
                </div>
                <div className="flex items-center gap-12">
                    {license.seats !== undefined && (
                        <div className="flex flex-col items-end">
                            <p className="text-xs text-muted-foreground">Billed seats</p>
                            <p className="text-sm">{license.seats}</p>
                        </div>
                    )}
                    <div className="flex flex-col items-end">
                        <p className="text-xs text-muted-foreground">
                            {isExpired ? "Expired on" : "Expires on"}
                        </p>
                        <p className="text-sm">{formatDate(expiryDate)}</p>
                    </div>
                </div>
            </div>
        </SettingsCard>
    );
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
