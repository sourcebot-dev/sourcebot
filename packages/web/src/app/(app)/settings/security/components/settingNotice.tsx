import { ReactNode } from "react";

interface SettingNoticeProps {
    children: ReactNode;
}

/**
 * An informational notice rendered below a setting's control, e.g. to explain
 * why a toggle is disabled or controlled by an environment variable.
 */
export function SettingNotice({ children }: SettingNoticeProps) {
    return (
        <div className="mt-3 p-3 rounded-md bg-muted border border-border">
            <p className="text-sm text-foreground leading-relaxed flex items-center gap-2">
                <svg
                    className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span>{children}</span>
            </p>
        </div>
    );
}
