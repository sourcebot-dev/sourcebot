import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { SOURCEBOT_CLOUD_ENVIRONMENT } from "@sourcebot/shared/client";

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);
export const tenancyModeSchema = z.enum(["multi", "single"]);

// Numbers are treated as strings in .env files.
// coerce helps us convert them to numbers.
// @see: https://zod.dev/?id=coercion-for-primitives
const numberSchema = z.coerce.number();

export const env = createEnv({
    server: {
        // Zoekt
        ZOEKT_WEBSERVER_URL: z.string().url().default("http://localhost:6070"),
        SHARD_MAX_MATCH_COUNT: numberSchema.default(10000),
        TOTAL_MAX_MATCH_COUNT: numberSchema.default(100000),
        ZOEKT_MAX_WALL_TIME_MS: numberSchema.default(10000),
        
        // Auth
        FORCE_ENABLE_ANONYMOUS_ACCESS: booleanSchema.default('false'),
        
        AUTH_SECRET: z.string(),
        AUTH_URL: z.string().url(),
        AUTH_CREDENTIALS_LOGIN_ENABLED: booleanSchema.default('true'),
        AUTH_EMAIL_CODE_LOGIN_ENABLED: booleanSchema.default('false'),

        // Enterprise Auth
        AUTH_EE_GITHUB_CLIENT_ID: z.string().optional(),
        AUTH_EE_GITHUB_CLIENT_SECRET: z.string().optional(),
        AUTH_EE_GITHUB_BASE_URL: z.string().optional(),

        AUTH_EE_GITLAB_CLIENT_ID: z.string().optional(),
        AUTH_EE_GITLAB_CLIENT_SECRET: z.string().optional(),
        AUTH_EE_GITLAB_BASE_URL: z.string().default("https://gitlab.com"),

        AUTH_EE_GOOGLE_CLIENT_ID: z.string().optional(),
        AUTH_EE_GOOGLE_CLIENT_SECRET: z.string().optional(),

        AUTH_EE_OKTA_CLIENT_ID: z.string().optional(),
        AUTH_EE_OKTA_CLIENT_SECRET: z.string().optional(),
        AUTH_EE_OKTA_ISSUER: z.string().optional(),

        AUTH_EE_KEYCLOAK_CLIENT_ID: z.string().optional(),
        AUTH_EE_KEYCLOAK_CLIENT_SECRET: z.string().optional(),
        AUTH_EE_KEYCLOAK_ISSUER: z.string().optional(),

        AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID: z.string().optional(),
        AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET: z.string().optional(),
        AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER: z.string().optional(),

        AUTH_EE_GCP_IAP_ENABLED: booleanSchema.default('false'),
        AUTH_EE_GCP_IAP_AUDIENCE: z.string().optional(),

        DATA_CACHE_DIR: z.string(),

        SOURCEBOT_PUBLIC_KEY_PATH: z.string(),

        // Email
        SMTP_CONNECTION_URL: z.string().url().optional(),
        EMAIL_FROM_ADDRESS: z.string().email().optional(),

        // Stripe
        STRIPE_SECRET_KEY: z.string().optional(),
        STRIPE_PRODUCT_ID: z.string().optional(),
        STRIPE_WEBHOOK_SECRET: z.string().optional(),
        STRIPE_ENABLE_TEST_CLOCKS: booleanSchema.default('false'),

        LOGTAIL_TOKEN: z.string().optional(),
        LOGTAIL_HOST: z.string().url().optional(),

        // Misc
        CONFIG_MAX_REPOS_NO_TOKEN: numberSchema.default(Number.MAX_SAFE_INTEGER),
        NODE_ENV: z.enum(["development", "test", "production"]),
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default('false'),
        DATABASE_URL: z.string().url(),

        SOURCEBOT_TENANCY_MODE: tenancyModeSchema.default("single"),
        CONFIG_PATH: z.string().optional(),

        // Misc UI flags
        SECURITY_CARD_ENABLED: booleanSchema.default('false'),

        // EE License
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_EE_AUDIT_LOGGING_ENABLED: booleanSchema.default('true'),

        // GitHub app for review agent
        GITHUB_APP_ID: z.string().optional(),
        GITHUB_APP_WEBHOOK_SECRET: z.string().optional(),
        GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
        REVIEW_AGENT_API_KEY: z.string().optional(),
        REVIEW_AGENT_LOGGING_ENABLED: booleanSchema.default('true'),
        REVIEW_AGENT_AUTO_REVIEW_ENABLED: booleanSchema.default('false'),
        REVIEW_AGENT_REVIEW_COMMAND: z.string().default('review'),

        ANTHROPIC_API_KEY: z.string().optional(),
        ANTHROPIC_MODEL: z.string().optional(),
        ANTHROPIC_THINKING_BUDGET_TOKENS: numberSchema.default(12000),

        OPENAI_API_KEY: z.string().optional(),
        OPENAI_MODEL: z.string().optional(),

        GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
        GOOGLE_GENERATIVE_AI_MODEL: z.string().optional(),

        AWS_BEDROCK_MODEL_DISPLAY_NAME: z.string().optional(),
        AWS_BEDROCK_MODEL: z.string().optional(),
        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_REGION: z.string().optional(),

        SOURCEBOT_CHAT_MODEL_TEMPERATURE: numberSchema.default(0.3),
        SOURCEBOT_CHAT_FILE_MAX_CHARACTERS: numberSchema.default(4000),

        SOURCEBOT_CHAT_MAX_STEP_COUNT: numberSchema.default(20),

        DEBUG_WRITE_CHAT_MESSAGES_TO_FILE: booleanSchema.default('false'),
    },
    // @NOTE: Please make sure of the following:
    // - Make sure you destructure all client variables in
    //   the `experimental__runtimeEnv` block below.
    // - Update the Dockerfile to pass these variables as build-args.
    client: {
        // PostHog
        NEXT_PUBLIC_POSTHOG_PAPIK: z.string().optional(),

        // Misc
        NEXT_PUBLIC_SOURCEBOT_VERSION: z.string().default('unknown'),
        NEXT_PUBLIC_POLLING_INTERVAL_MS: numberSchema.default(5000),

        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: z.enum(SOURCEBOT_CLOUD_ENVIRONMENT).optional(),
    },
    // For Next.js >= 13.4.4, you only need to destructure client variables:
    experimental__runtimeEnv: {
        NEXT_PUBLIC_POSTHOG_PAPIK: process.env.NEXT_PUBLIC_POSTHOG_PAPIK,
        NEXT_PUBLIC_SOURCEBOT_VERSION: process.env.NEXT_PUBLIC_SOURCEBOT_VERSION,
        NEXT_PUBLIC_POLLING_INTERVAL_MS: process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS,
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: process.env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT,
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
    emptyStringAsUndefined: true,
});