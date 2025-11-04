export type IntegrationIdentityProviderState = {
    id: string;
    required: boolean;
    isLinked: boolean;
    linkedAccountId?: string;
};