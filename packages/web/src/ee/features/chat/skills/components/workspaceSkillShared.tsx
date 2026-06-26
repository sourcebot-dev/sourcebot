'use client';

import type { ReactNode } from "react";
import { Building2Icon } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const FEATURED_SKILL_TOOLTIP = "Shown first in shared skill lists.";
export const AUTO_ENROLLED_SKILL_TOOLTIP = "Added to members' Ask commands by default.";

export function SkillCommandBadge({ slug }: { slug: string }) {
    return (
        <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            /{slug}
        </span>
    );
}

function SkillStatusBadge({
    children,
    tooltip,
    className,
}: {
    children: ReactNode;
    tooltip?: string;
    className?: string;
}) {
    const badge = (
        <span
            className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
                className ?? "border-border bg-background text-muted-foreground",
            )}
            tabIndex={tooltip ? 0 : undefined}
        >
            {children}
        </span>
    );

    if (!tooltip) {
        return badge;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

export function FeaturedSkillBadge() {
    return (
        <SkillStatusBadge
            tooltip={FEATURED_SKILL_TOOLTIP}
            className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:border-amber-500/50 dark:bg-amber-950/60 dark:text-amber-400"
        >
            Featured
        </SkillStatusBadge>
    );
}

export function AutoEnrolledSkillBadge() {
    return (
        <SkillStatusBadge
            tooltip={AUTO_ENROLLED_SKILL_TOOLTIP}
            className="border-sky-500/40 bg-sky-500/15 text-sky-700 dark:border-sky-500/50 dark:bg-sky-950/60 dark:text-sky-400"
        >
            Auto
        </SkillStatusBadge>
    );
}

export function WorkspaceSkillsEmptyState({
    description = "Shared skills created by members will appear here.",
}: {
    description?: string;
}) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="rounded-full bg-muted p-3 mb-4">
                    <Building2Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                    No shared skills yet
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

export function OrgSkillFlagToggle({
    label,
    checked,
    disabled,
    onCheckedChange,
}: {
    label: string;
    checked: boolean;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{label}</span>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={onCheckedChange}
                className="scale-75"
            />
        </label>
    );
}

export function DeleteWorkspaceSkillDialog({
    skill,
    isDeleting,
    disabled = false,
    onOpenChange,
    onConfirm,
}: {
    skill: { name: string; slug: string } | null;
    isDeleting: boolean;
    disabled?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}) {
    const isActionDisabled = isDeleting || disabled;

    return (
        <AlertDialog open={skill !== null} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Shared Skill</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <span className="font-semibold text-foreground">{skill?.name}</span>? This removes the <span className="font-mono text-foreground">/{skill?.slug}</span> command for everyone in this workspace.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isActionDisabled}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isActionDisabled}
                        onClick={(event) => {
                            event.preventDefault();
                            onConfirm();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
