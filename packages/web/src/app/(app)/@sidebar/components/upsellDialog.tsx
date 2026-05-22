"use client";

import { useCallback, useState } from "react";
import { ArrowUpCircle, CircleCheck, CircleX, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Switch } from "@/components/ui/switch";
import { cn, isServiceError } from "@/lib/utils";
import { createCheckoutSession } from "@/ee/features/lighthouse/actions";
import { useToast } from "@/components/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface FeatureLinkProps {
    text: string;
    href: string;
}

function FeatureLink({ text, href }: FeatureLinkProps) {
    return (
        <TableCell>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-1.5"
            >
                {text}
                <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
        </TableCell>
    );
}

interface SupportIconProps {
    supported: boolean;
}

function SupportIcon({ supported }: SupportIconProps) {
    const Icon = supported ? CircleCheck : CircleX;
    return (
        <TableCell>
            <Icon className={
                cn("h-4 w-4 text-primary text-gray-100 rounded-full", {
                    "bg-blue-500": supported,
                    "bg-gray-500": !supported
                })}
            />
        </TableCell>
    );
}

interface UpsellDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trialAvailable: boolean;
}

type BillingInterval = "year" | "month";

export function UpsellDialog({ open, onOpenChange, trialAvailable }: UpsellDialogProps) {
    const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
    const [isCheckoutSessionCreating, setIsCheckoutSessionCreating] = useState(false);
    const { toast } = useToast();

    const enterprisePrice = billingInterval === "year"
        ? "$16 per user/month, annually"
        : "$20 per user/month";

    const handlePrimaryAction = useCallback(() => {
        setIsCheckoutSessionCreating(true);
        createCheckoutSession({
            requestTrial: trialAvailable,
            interval: billingInterval,
        })
            .then((response) => {
                if (isServiceError(response)) {
                    toast({
                        description: `Failed to start checkout: ${response.message}`,
                        variant: "destructive",
                    });
                    setIsCheckoutSessionCreating(false);
                } else {
                    window.location.assign(response.url);
                }
            })
            .catch(() => {
                toast({
                    description: "Failed to start checkout. Please try again.",
                    variant: "destructive",
                });
                setIsCheckoutSessionCreating(false);
            })
    }, [trialAvailable, billingInterval, toast]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl gap-6">
                <DialogHeader className="gap-1">
                    <ArrowUpCircle className="h-6 w-6 bg-blue-500 text-gray-100 rounded-full" />
                    <DialogTitle>
                        {trialAvailable
                            ? "Try Sourcebot Enterprise free"
                            : "Your workspace is on the free plan"}
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        {trialAvailable
                            ? "Get full access. No credit card required."
                            : "Upgrade to unlock more features."}
                    </DialogDescription>
                </DialogHeader>

                <Table
                    wrapperClassName="mx-auto"
                    className="[&_th:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r [&_td]:py-2"
                >
                    <TableHeader>
                        <TableRow>
                            <TableHead />
                            <TableHead className="w-52 align-top">
                                <div className="text-lg text-primary">Community</div>
                                <div className="text-xs text-muted-foreground font-normal mt-0.5">Free</div>
                            </TableHead>
                            <TableHead className="w-52 align-top">
                                <span className="text-lg text-primary">Enterprise</span>
                                <div className="text-xs text-muted-foreground font-normal mt-0.5">{enterprisePrice}</div>
                                <div className="flex items-center my-1">
                                    <Switch
                                        checked={billingInterval === "year"}
                                        onCheckedChange={(checked) => setBillingInterval(checked ? "year" : "month")}
                                        className="scale-75 origin-left"
                                    />
                                    <span className="text-xs font-normal">
                                        Annual billing
                                    </span>
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <FeatureLink text="Code search" href="https://docs.sourcebot.dev/docs/features/search/overview" />
                            <SupportIcon supported />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="Code browsing" href="https://www.sourcebot.dev/changelog/file-explorer" />
                            <SupportIcon supported />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="Ask Sourcebot" href="https://docs.sourcebot.dev/docs/features/ask/overview" />
                            <SupportIcon supported={false} />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="Code navigation" href="https://docs.sourcebot.dev/docs/features/code-navigation" />
                            <SupportIcon supported={false} />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="SSO & OAuth" href="https://docs.sourcebot.dev/docs/configuration/idp" />
                            <SupportIcon supported={false} />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="Permission syncing" href="https://docs.sourcebot.dev/docs/features/permission-syncing" />
                            <SupportIcon supported={false} />
                            <SupportIcon supported />
                        </TableRow>
                        <TableRow>
                            <FeatureLink text="Audit logs" href="https://docs.sourcebot.dev/docs/configuration/audit-logs" />
                            <SupportIcon supported={false} />
                            <SupportIcon supported />
                        </TableRow>
                    </TableBody>
                </Table>

                <DialogFooter className="items-center gap-2 sm:gap-4">
                    <Button variant="ghost" asChild>
                        <a
                            href="https://www.sourcebot.dev/pricing"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            See all plans
                            <ExternalLink className="h-3.5 w-3.5 ml-2" />
                        </a>
                    </Button>
                    <LoadingButton onClick={handlePrimaryAction} loading={isCheckoutSessionCreating}>
                        {trialAvailable ? "Start free trial" : "Upgrade"}
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
