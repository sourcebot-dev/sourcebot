import React from "react";
import { cn } from "@/lib/utils";

type SettingsContainerVariant = "centered" | "full";

interface SettingsContainerProps {
    children: React.ReactNode;
    variant?: SettingsContainerVariant;
}

export const SettingsContainer = ({ children, variant = "centered" }: SettingsContainerProps) => {
    const isFull = variant === "full";
    return (
        <main className={cn("flex justify-center p-4", isFull && "h-full min-h-0")}>
            <div className={cn("w-full rounded-lg p-6", isFull ? "flex min-h-0 flex-col" : "max-w-3xl")}>
                <div className={cn("w-full rounded-lg", isFull && "flex min-h-0 flex-1 flex-col")}>{children}</div>
            </div>
        </main>
    );
};
