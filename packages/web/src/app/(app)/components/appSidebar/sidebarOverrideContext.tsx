"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type SidebarCollapsible = "icon" | "offcanvas" | "none";

interface SidebarOverride {
    header?: ReactNode;
    content?: ReactNode;
    collapsible?: SidebarCollapsible;
}

interface SidebarOverrideContextValue {
    override: SidebarOverride | null;
    setOverride: (override: SidebarOverride | null) => void;
}

const SidebarOverrideContext = createContext<SidebarOverrideContextValue | null>(null);

export function SidebarOverrideProvider({ children }: { children: ReactNode }) {
    const [override, setOverride] = useState<SidebarOverride | null>(null);
    return (
        <SidebarOverrideContext.Provider value={{ override, setOverride }}>
            {children}
        </SidebarOverrideContext.Provider>
    );
}

export function useSidebarOverride() {
    return useContext(SidebarOverrideContext);
}

interface SetSidebarOverrideProps {
    header?: ReactNode;
    content?: ReactNode;
    collapsible?: SidebarCollapsible;
}

export function SetSidebarOverride({ header, content, collapsible }: SetSidebarOverrideProps) {
    const ctx = useContext(SidebarOverrideContext);
    useEffect(() => {
        ctx?.setOverride({ header, content, collapsible });
        return () => ctx?.setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [header, content, collapsible]);
    return null;
}
