import * as Sentry from "@sentry/nextjs";

type SentryUser = {
    id: string;
    email?: string | null;
    name?: string | null;
};

/**
 * Associates subsequent Sentry events with the current user, including their
 * email and name only when PII collection is enabled. If Sentry is not
 * configured, this is effectively a no-op and does not send any data.
 */
export function setSentryUser(user: SentryUser | null, isPiiEnabled: boolean) {
    if (!user) {
        Sentry.setUser(null);
        return;
    }

    Sentry.setUser({
        id: user.id,
        ...(isPiiEnabled ? {
            email: user.email ?? undefined,
            username: user.name ?? undefined,
        } : {}),
    });
}
