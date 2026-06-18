'use client';

import { usePathname } from "next/navigation";

// Routes that opt out of the centered settings column and render edge-to-edge
// (e.g. the full-bleed skill editor). Everything else stays in the constrained,
// centered column shared by the rest of settings.
const FULL_BLEED_ROUTE_PATTERNS = [
    /^\/settings\/accountAskAgent\/skills(\/|$)/,
    /^\/settings\/accountAskAgent\/workspaceSkills(\/|$)/,
];

export function SettingsContentFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isFullBleed = FULL_BLEED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

    if (isFullBleed) {
        return <div className="h-full">{children}</div>;
    }

    return (
        <main className="flex justify-center p-4">
            <div className="w-full max-w-3xl rounded-lg p-6">
                <div className="w-full rounded-lg">{children}</div>
            </div>
        </main>
    );
}
