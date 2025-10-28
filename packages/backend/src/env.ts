import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import dotenv from 'dotenv';

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);

// Numbers are treated as strings in .env files.
// coerce helps us convert them to numbers.
// @see: https://zod.dev/?id=coercion-for-primitives
const numberSchema = z.coerce.number();

dotenv.config({
	path: './.env',
});

dotenv.config({
	path: './.env.local',
	override: true
});

export const env = createEnv({
    server: {
        SOURCEBOT_ENCRYPTION_KEY: z.string(),
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default("false"),
        SOURCEBOT_INSTALL_ID: z.string().default("unknown"),
        NEXT_PUBLIC_SOURCEBOT_VERSION: z.string().default("unknown"),

        DATA_CACHE_DIR: z.string(),

        NEXT_PUBLIC_POSTHOG_PAPIK: z.string().optional(),

        FALLBACK_GITHUB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITLAB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITEA_CLOUD_TOKEN: z.string().optional(),

        REDIS_URL: z.string().url().default("redis://localhost:6379"),
        REDIS_REMOVE_ON_COMPLETE: numberSchema.default(0),
        REDIS_REMOVE_ON_FAIL: numberSchema.default(100),

        NEXT_PUBLIC_SENTRY_BACKEND_DSN: z.string().optional(),
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),

        LOGTAIL_TOKEN: z.string().optional(),
        LOGTAIL_HOST: z.string().url().optional(),
        SOURCEBOT_LOG_LEVEL: z.enum(["info", "debug", "warn", "error"]).default("info"),
        DEBUG_ENABLE_GROUPMQ_LOGGING: booleanSchema.default('false'),

        DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/postgres"),
        CONFIG_PATH: z.string(),

        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: numberSchema.default(300000),
        REPO_SYNC_RETRY_BASE_SLEEP_SECONDS: numberSchema.default(60),

        GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS: numberSchema.default(60 * 10),

        EXPERIMENT_EE_PERMISSION_SYNC_ENABLED: booleanSchema.default('false'),
        AUTH_EE_GITHUB_BASE_URL: z.string().optional(),

        FORCE_ENABLE_ANONYMOUS_ACCESS: booleanSchema.default('false'),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});