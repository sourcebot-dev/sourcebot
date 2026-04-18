import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Invoice } from "@/ee/features/lighthouse/types";
import { SettingsCard, SettingsCardGroup } from "../components/settingsCard";
import { Button } from "@/components/ui/button";

interface RecentInvoicesCardProps {
    invoices: Invoice[];
}

export function RecentInvoicesCard({ invoices }: RecentInvoicesCardProps) {
    if (invoices.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="font-medium">Recent invoices</p>
            <SettingsCardGroup>
                {invoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} />
                ))}
            </SettingsCardGroup>
        </div>
    );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
    return (
        <SettingsCard>
            <div className="flex items-center gap-6">
                <p className="text-sm w-32 shrink-0 font-medium">{formatDate(invoice.createdAt)}</p>
                <p className="text-sm text-muted-foreground flex-1">
                    {formatCurrency(invoice.amount, invoice.currency)}
                </p>
                {invoice.hostedInvoiceUrl && (
                    <Button variant="ghost" asChild>
                        <Link
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View invoice"
                        >
                            View <ExternalLink className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
            </div>
        </SettingsCard>
    );
}

function formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatCurrency(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amountCents / 100);
}
