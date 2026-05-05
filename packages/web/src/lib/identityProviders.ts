import { getProviders } from "@/auth";

export interface IdentityProviderMetadata {
    /** Unique instance id (e.g., 'github', 'gitlab-corp') — used for `signIn(id)`. */
    id: string;
    /** Provider type (e.g., 'github', 'gitlab') — used to pick icons / event names. */
    type: string;
    /** Optional admin-supplied display name from config; overrides type-derived defaults in the UI. */
    displayName?: string;
    purpose: "sso" | "account_linking";
    required: boolean;
}

export const getIdentityProviderMetadata = async (): Promise<IdentityProviderMetadata[]> => {
    const providers = await getProviders();
    return providers.map((provider) => {
        return {
            id: provider.id,
            type: provider.type,
            displayName: provider.displayName,
            purpose: provider.purpose,
            required: provider.required ?? false,
        };
    });
};