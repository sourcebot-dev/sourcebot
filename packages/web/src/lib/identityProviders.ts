import { getProviders } from "@/auth";

export interface IdentityProviderMetadata {
    id: string;
    name: string;
    purpose: "sso" | "account_linking";
    required: boolean;
}

export const getIdentityProviderMetadata = (): IdentityProviderMetadata[] => {
    const providers = getProviders();
    return providers.map((provider) => {
        if (typeof provider.provider === "function") {
            const providerInfo = provider.provider();
            return {
                id: providerInfo.id,
                name: providerInfo.name,
                purpose: provider.purpose,
                required: provider.required ?? false,
            };
        } else {
            return {
                id: provider.provider.id,
                name: provider.provider.name,
                purpose: provider.purpose,
                required: provider.required ?? false,
            };
        }
    });
}; 