'use client';

import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { createContext, useCallback, useEffect, useState } from "react";

export interface BrowseState {
    selectedSymbolInfo?: {
        symbolName: string;
        repoName: string;
        revisionName: string;
        language: string;
    }
    isBottomPanelCollapsed: boolean;
    activeExploreMenuTab: "references" | "definitions";
    bottomPanelSize: number;
    repoName: string;
    revisionName: string;
}

const defaultState: BrowseState = {
    selectedSymbolInfo: undefined,
    isBottomPanelCollapsed: true,
    activeExploreMenuTab: "references",
    bottomPanelSize: 35,
    repoName: '',
    revisionName: '',
};

export const SET_BROWSE_STATE_QUERY_PARAM = "setBrowseState";

export const BrowseStateContext = createContext<{
    state: BrowseState;
    updateBrowseState: (state: Partial<BrowseState>) => void;
}>({
    state: defaultState,
    updateBrowseState: () => {},
});

interface BrowseStateProviderProps {
    children: React.ReactNode;
    repoName: string;
    revisionName: string;
}

export const BrowseStateProvider = ({ children, repoName, revisionName }: BrowseStateProviderProps) => {
    const [state, setState] = useState<BrowseState>({
        ...defaultState,
        repoName,
        revisionName,
    });

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