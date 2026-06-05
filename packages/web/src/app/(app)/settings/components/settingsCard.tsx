"use client";

import { Separator } from "@/components/ui/separator";
import { createContext, ReactNode, useContext, Children } from "react";

const SettingsCardGroupContext = createContext(false);

interface SettingsCardProps {
    children: ReactNode;
}

export function SettingsCard({ children }: SettingsCardProps) {
    const isInGroup = useContext(SettingsCardGroupContext);

    if (isInGroup) {
        return <div className="p-4">{children}</div>;
    }

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            {children}
        </div>
    );
}

interface BasicSettingsCardProps {
    name: string;
    description: string;
    children: ReactNode;
}

export function BasicSettingsCard({ name, description, children }: BasicSettingsCardProps) {
    return (
        <SettingsCard>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>
                <div className="flex-shrink-0">
                    {children}
                </div>
            </div>
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
