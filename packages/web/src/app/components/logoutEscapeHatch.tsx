"use client";

import { LogOutIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import posthog from "posthog-js";

interface LogoutEscapeHatchProps {
    className?: string;
}

export const LogoutEscapeHatch = ({
    className,
}: LogoutEscapeHatchProps) => {
    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => {
                    signOut({
                        redirectTo: "/login",
                    }).then(() => {
                        posthog.reset();
                    });
                }}
                className="flex flex-row items-center gap-2 text-sm text-muted-foreground cursor-pointer"
            >
                <LogOutIcon className="w-4 h-4" />
                Log out
            </button>
        </div>
    );
}
