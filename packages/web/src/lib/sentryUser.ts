import * as Sentry from "@sentry/nextjs";

type SentryUser = {
    id: string;
    email?: string | null;
    name?: string | null;
};

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
