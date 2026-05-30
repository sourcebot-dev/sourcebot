'use client';

import { createContext, useContext } from "react";

const HasLicenseContext = createContext<boolean>(false);

interface HasLicenseProviderProps {
    children: React.ReactNode;
    hasLicense: boolean;
}

export const HasLicenseProvider = ({ children, hasLicense }: HasLicenseProviderProps) => (
    <HasLicenseContext.Provider value={hasLicense}>{children}</HasLicenseContext.Provider>
);

export const useHasLicense = () => useContext(HasLicenseContext);
