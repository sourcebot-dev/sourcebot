"use client";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { createContext, ReactNode, useContext, Children } from "react";

const SettingsCardGroupContext = createContext(false);

interface SettingsCardProps {
    children: ReactNode;
    className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
    const isInGroup = useContext(SettingsCardGroupContext);

    if (isInGroup) {
        return <div className={cn("p-4", className)}>{children}</div>;
    }

    return (
        <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
            {children}
        </div>
    );
}

interface BasicSettingsCardProps {
    name: string;
    description?: string;
    children: ReactNode;
    /** Optional content rendered full-width below the name/description/control row (e.g. an info notice or an expandable section). */
    footer?: ReactNode;
    className?: string;
}

export function BasicSettingsCard({ name, description, children, footer, className }: BasicSettingsCardProps) {
    return (
        <SettingsCard className={className}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{name}</p>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
                <div className="flex-shrink-0">
                    {children}
                </div>
            </div>
            {footer}
        </SettingsCard>
    );
}

interface SettingsCardGroupProps {
    children: ReactNode;
}

export function SettingsCardGroup({ children }: SettingsCardGroupProps) {
    const childArray = Children.toArray(children);

    return (
        <SettingsCardGroupContext.Provider value={true}>
            <div className="rounded-lg border border-border bg-card">
                {childArray.map((child, index) => (
                    <div key={index}>
                        {child}
                        {index < childArray.length - 1 && <Separator />}
                    </div>
                ))}
            </div>
        </SettingsCardGroupContext.Provider>
    );
}
