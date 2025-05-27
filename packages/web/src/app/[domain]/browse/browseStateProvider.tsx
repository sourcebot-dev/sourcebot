'use client';

import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { createContext, useCallback, useEffect, useState } from "react";
import { BOTTOM_PANEL_MIN_SIZE } from "./components/bottomPanel";

export interface BrowseState {
    selectedSymbolInfo?: {
        symbolName: string;
        repoName: string;
        revisionName: string;
    }
    isBottomPanelCollapsed: boolean;
    activeExploreMenuTab: "references" | "definitions";
    bottomPanelSize: number;
}

const defaultState: BrowseState = {
    selectedSymbolInfo: undefined,
    isBottomPanelCollapsed: true,
    activeExploreMenuTab: "references",
    bottomPanelSize: BOTTOM_PANEL_MIN_SIZE,
};

export const SET_BROWSE_STATE_QUERY_PARAM = "setBrowseState";

export const BrowseStateContext = createContext<{
    state: BrowseState;
    updateBrowseState: (state: Partial<BrowseState>) => void;
}>({
    state: defaultState,
    updateBrowseState: () => {},
});

export const BrowseStateProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<BrowseState>(defaultState);
    const hydratedBrowseState = useNonEmptyQueryParam(SET_BROWSE_STATE_QUERY_PARAM);

    const onUpdateState = useCallback((state: Partial<BrowseState>) => {
        setState((prevState) => ({
            ...prevState,
            ...state,
        }));
    }, []);

    useEffect(() => {
        if (hydratedBrowseState) {
            try {
                const parsedState = JSON.parse(hydratedBrowseState) as Partial<BrowseState>;
                onUpdateState(parsedState);
            } catch (error) {
                console.error("Error parsing hydratedBrowseState", error);
            }

            // Remove the query param
            const url = new URL(window.location.href);
            url.searchParams.delete(SET_BROWSE_STATE_QUERY_PARAM);
            window.history.replaceState({}, '', url.toString());
        }
    }, [hydratedBrowseState, onUpdateState]);

    return (
        <BrowseStateContext.Provider
            value={{
                state,
                updateBrowseState: onUpdateState,
            }}
        >
            {children}
        </BrowseStateContext.Provider>
    );
};