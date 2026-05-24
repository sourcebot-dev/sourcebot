'use client';

import { createContext } from "react";
import { OrgRole } from "@sourcebot/db";

export const RoleContext = createContext<{ role: OrgRole | null }>({ role: null });

interface RoleProviderProps {
    children: React.ReactNode;
    role: OrgRole | null;
}

export const RoleProvider = ({ children, role }: RoleProviderProps) => {
    return (
        <RoleContext.Provider
            value={{ role }}
        >
            {children}
        </RoleContext.Provider>
    )
};
