'use client';

import { createContext } from "react";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";

export const IdentityProvidersContext = createContext<{ providers: IdentityProviderMetadata[] }>({ providers: [] });

interface IdentityProvidersProviderProps {
    children: React.ReactNode;
    providers: IdentityProviderMetadata[];
}

export const IdentityProvidersProvider = ({ children, providers }: IdentityProvidersProviderProps) => {
    return (
        <IdentityProvidersContext.Provider
            value={{ providers }}
        >
            {children}
        </IdentityProvidersContext.Provider>
    )
};
