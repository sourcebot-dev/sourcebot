'use client';

import { useContext } from "react";
import { BrowseStateContext } from "../browseStateProvider";

export const useBrowseState = () => {
    const context = useContext(BrowseStateContext);
    if (!context) {
        throw new Error('useBrowseState must be used within a BrowseStateProvider');
    }
    return context;
}