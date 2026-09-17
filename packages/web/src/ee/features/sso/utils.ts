import type { LinkedAccount } from "./types";

/** Returns whether any account-linking provider is not yet linked. */
export const hasUnlinkedProviders = (accounts: readonly LinkedAccount[]): boolean =>
    accounts.some(account => account.isAccountLinkingProvider && !account.isLinked);

/** Returns whether any required account-linking provider is not yet linked. */
export const hasRequiredUnlinkedProviders = (accounts: readonly LinkedAccount[]): boolean =>
    accounts.some(account => account.isAccountLinkingProvider && account.required && !account.isLinked);

/** Returns whether an unlinked optional account-linking provider has not been skipped. */
export const hasUnskippedOptionalProviders = (accounts: readonly LinkedAccount[], skippedProviderIds: readonly string[]): boolean =>
    accounts.some(account => account.isAccountLinkingProvider && !account.required && !account.isLinked && !skippedProviderIds.includes(account.providerId));

/** Reads skipped provider IDs, treating legacy boolean cookies and invalid values as empty. */
export const parseSkippedOptionalProviderIds = (value: string | undefined): string[] => {
    if (!value) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every(id => typeof id === 'string') ? parsed : [];
    } catch {
        return [];
    }
};
