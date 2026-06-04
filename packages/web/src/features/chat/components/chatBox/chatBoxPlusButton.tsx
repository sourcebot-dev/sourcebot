'use client';

import type { SearchScope } from "@/features/chat/types";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";
import { ConnectorsMenu } from "@/ee/features/chat/mcp/components/connectorsMenu";
import { ConnectorsExplainerMenu } from "./connectorsExplainerMenu";

interface ChatBoxPlusButtonProps {
    selectedSearchScopes: SearchScope[];
    onSelectedSearchScopesChange: (items: SearchScope[]) => void;
    disabledMcpServerIds: string[];
    onDisabledMcpServerIdsChange: (ids: string[]) => void;
    isAuthenticated: boolean;
}

/**
 * Entitlement-aware "+" button for the chat box. The connector machinery lives
 * in ee/ and only ever renders/runs when the `ask` entitlement is present;
 * free-plan users render the FSL explainer instead. Static-importing the ee/
 * component is fine — it is only invoked behind the entitlement check below.
 */
export const ChatBoxPlusButton = (props: ChatBoxPlusButtonProps) => {
    const hasAskEntitlement = useHasEntitlement('ask');

    if (hasAskEntitlement) {
        return <ConnectorsMenu {...props} />;
    }

    return <ConnectorsExplainerMenu />;
};
