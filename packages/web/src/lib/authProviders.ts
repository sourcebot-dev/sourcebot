import { getProviders } from "@/auth";

export interface AuthProvider {
    id: string;
    name: string;
}

export const getAuthProviders = (): AuthProvider[] => {
    const providers = getProviders();
    return providers.map((provider) => {
        if (typeof provider === "function") {
            const providerInfo = provider();
            return { id: providerInfo.id, name: providerInfo.name };
        } else {
            return { id: provider.id, name: provider.name };
        }
    });
}; 