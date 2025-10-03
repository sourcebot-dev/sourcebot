import * as Sentry from '@sentry/nextjs';
import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export async function register() {
    if (
        process.env.LANGFUSE_SECRET_KEY &&
        process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
    ) {
        console.log("Registering Langfuse");
        registerOTel({
            serviceName: 'sourcebot',
            traceExporter: new LangfuseExporter({
                secretKey: process.env.LANGFUSE_SECRET_KEY,
                publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
                baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
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
        await import('./initialize');
    }
}

export const onRequestError = Sentry.captureRequestError;
