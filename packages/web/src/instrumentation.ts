import * as Sentry from '@sentry/nextjs';
import { registerOTel } from '@vercel/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

export async function register() {
    if (
        process.env.LANGFUSE_SECRET_KEY &&
        process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
    ) {
        console.log("Registering Langfuse");
        const sdk = new NodeSDK({
            serviceName: 'sourcebot',
            spanProcessors: [
                new LangfuseSpanProcessor({
                    secretKey: process.env.LANGFUSE_SECRET_KEY,
                    publicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
                    baseUrl: process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
                }),
            ],
        });
        sdk.start();
        registerOTel({ serviceName: 'sourcebot' });
    }

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
