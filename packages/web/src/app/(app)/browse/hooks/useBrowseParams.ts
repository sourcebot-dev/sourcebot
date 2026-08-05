import { createContext, useContext } from "react";
import type { BrowseProps } from "./utils";

export const BrowseParamsContext = createContext<BrowseProps | null>(null);

export const useBrowseParams = () => {
    const browseParams = useContext(BrowseParamsContext);
    if (!browseParams) {
        throw new Error('useBrowseParams must be used within a BrowseParamsContext provider');
    }

    return browseParams;
}
