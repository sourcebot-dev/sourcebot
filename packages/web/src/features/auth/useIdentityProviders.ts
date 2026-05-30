'use client';

import { useContext } from "react";
import { IdentityProvidersContext } from "./identityProvidersProvider";

export const useIdentityProviders = () => {
    const { providers } = useContext(IdentityProvidersContext);
    return providers;
}
