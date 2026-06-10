'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CableIcon, PlusIcon } from "lucide-react";
import { UpsellDialog } from "@/features/billing/upsellDialog";

// TODO(ask): finalize the connectors docs URL once the page exists.
const CONNECTORS_DOCS_URL = "https://docs.sourcebot.dev/docs/features/ask/connectors";

/**
 * Free-plan stand-in for the connectors menu. This is intentionally NOT in ee/:
 * unlicensed users only ever render this explainer, never the real connector
 * machinery (which lives in ee/ and runs solely behind the `mcp` entitlement).
 * The "+" button stays visible so the feature is still discoverable, and the
 * "paid plan" link opens the shared trial/upgrade dialog.
 */
export const ConnectorsExplainerMenu = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUpsellOpen, setIsUpsellOpen] = useState(false);

    const openUpsell = () => {
        // Close the dropdown first, then open the dialog on the next frame so the
        // menu's overlay/pointer-events cleanup finishes before the dialog's focus
        // trap mounts (avoids a Radix stacked-overlay race).
        setIsMenuOpen(false);
        requestAnimationFrame(() => setIsUpsellOpen(true));
    };

    return (
        <>
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-muted-foreground hover:text-primary"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="start" className="w-72" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuLabel className="flex items-center gap-2">
                        <CableIcon className="w-4 h-4 text-muted-foreground" />
                        Connectors
                    </DropdownMenuLabel>
                    <p className="px-2 pb-1.5 text-xs text-muted-foreground">
                        Connect external tools like Linear or Jira so the agent can pull in context beyond your code. Connectors are available on a{" "}
                        <button
                            type="button"
                            onClick={openUpsell}
                            className="text-link hover:underline"
                        >
                            paid plan
                        </button>. <a href={CONNECTORS_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">Learn more</a>
                    </p>
                </DropdownMenuContent>
            </DropdownMenu>
            <UpsellDialog open={isUpsellOpen} onOpenChange={setIsUpsellOpen} source="chat_connectors" />
        </>
    );
};
