export type LinkedAccountProviderState = {
    id: string;
    required: boolean;
    isLinked: boolean;
    linkedAccountId?: string;
    error?: string;
};