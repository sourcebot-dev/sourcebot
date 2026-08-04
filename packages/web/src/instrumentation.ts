import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initialize } = await import('./initialize');
        await initialize();
    }
}

export const onRequestError = Sentry.captureRequestError;
