import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);

export const env = createEnv({
    server: {
        // Zoekt
        ZOEKT_WEBSERVER_URL: z.string().url(),
        SHARD_MAX_MATCH_COUNT: z.number().default(10000),
        TOTAL_MAX_MATCH_COUNT: z.number().default(100000),
        
        // Auth
        AUTH_SECRET: z.string(),
        AUTH_GITHUB_CLIENT_ID: z.string().optional(),
        AUTH_GITHUB_CLIENT_SECRET: z.string().optional(),
        AUTH_GOOGLE_CLIENT_ID: z.string().optional(),
        AUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
        AUTH_URL: z.string().url(),
        AUTH_CREDENTIALS_LOGIN_ENABLED: booleanSchema.default('true'),

        // Email
        SMTP_CONNECTION_URL: z.string().url().optional(),
        EMAIL_FROM: z.string().email().optional(),

        // Stripe
        STRIPE_SECRET_KEY: z.string().optional(),
        STRIPE_PRODUCT_ID: z.string().optional(),
        STRIPE_WEBHOOK_SECRET: z.string().optional(),

        // Misc
        CONFIG_MAX_REPOS_NO_TOKEN: z.number().default(500),
        SOURCEBOT_ROOT_DOMAIN: z.string().default("localhost:3000"),
        NODE_ENV: z.enum(["development", "test", "production"]),
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default('false'),
        DATABASE_URL: z.string().url(),
    },
    // @NOTE: Make sure you destructure all client variables in the
    // `experimental__runtimeEnv` block below.
    client: {
        // PostHog
        NEXT_PUBLIC_POSTHOG_PAPIK: z.string().optional(),

        // Misc
        NEXT_PUBLIC_SOURCEBOT_VERSION: z.string().default('unknown'),
        NEXT_PUBLIC_POLLING_INTERVAL_MS: z.number().default(5000),
    },
    // For Next.js >= 13.4.4, you only need to destructure client variables:
    experimental__runtimeEnv: {
        NEXT_PUBLIC_POSTHOG_PAPIK: process.env.NEXT_PUBLIC_POSTHOG_PAPIK,
        NEXT_PUBLIC_SOURCEBOT_VERSION: process.env.NEXT_PUBLIC_SOURCEBOT_VERSION,
        NEXT_PUBLIC_POLLING_INTERVAL_MS: process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
    },
    // Skip environment variable validation in Docker builds.
    skipValidation: process.env.DOCKER_BUILD === "1",
    emptyStringAsUndefined: true,
});