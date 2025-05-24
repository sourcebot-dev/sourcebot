'use client';

import { createContext, useCallback, useState } from "react";

interface BrowseStateProvider {
    selectedSymbolInfo?: {
        symbolName: string;
        repoName: string
    }
    isBottomPanelCollapsed: boolean;
    activeExploreMenuTab: "references" | "definitions";
}

const defaultState: BrowseStateProvider = {
    selectedSymbolInfo: undefined,
    isBottomPanelCollapsed: true,
    activeExploreMenuTab: "references",
};

export const BrowseStateContext = createContext<{
    state: BrowseStateProvider;
    updateBrowseState: (state: Partial<BrowseStateProvider>) => void;
}>({
    state: defaultState,
    updateBrowseState: () => {},
});

export const BrowseStateProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState<BrowseStateProvider>(defaultState);

    const onUpdateState = useCallback((state: Partial<BrowseStateProvider>) => {
        setState((prevState) => ({
            ...prevState,
            ...state,
        }));
    }, []);

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