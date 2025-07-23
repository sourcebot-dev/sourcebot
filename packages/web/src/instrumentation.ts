import * as Sentry from '@sentry/nextjs';
import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';
import { env } from './env.mjs';

export async function register() {
    if (env.LANGFUSE_SECRET_KEY && env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY) {
        registerOTel({
            serviceName: 'sourcebot',
            traceExporter: new LangfuseExporter({
                secretKey: env.LANGFUSE_SECRET_KEY,
                publicKey: env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
                baseUrl: env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
            }),
        });
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }

    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import ('./initialize');
    }
}

export const onRequestError = Sentry.captureRequestError;
