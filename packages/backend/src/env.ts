import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import dotenv from 'dotenv';

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);

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
        SOURCEBOT_LOG_LEVEL: z.enum(["info", "debug", "warn", "error"]).default("info"),
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default("false"),
        SOURCEBOT_INSTALL_ID: z.string().default("unknown"),
        SOURCEBOT_VERSION: z.string().default("unknown"),

        POSTHOG_PAPIK: z.string().optional(),

        FALLBACK_GITHUB_TOKEN: z.string().optional(),
        FALLBACK_GITLAB_TOKEN: z.string().optional(),
        FALLBACK_GITEA_TOKEN: z.string().optional(),

        REDIS_URL: z.string().url(),

        SENTRY_BACKEND_DSN: z.string().optional(),
        SENTRY_ENVIRONMENT: z.string().optional(),

        LOGTAIL_TOKEN: z.string().optional(),
        LOGTAIL_HOST: z.string().url().optional(),

        INDEX_CONCURRENCY_MULTIPLE: z.number().optional(),
        DATABASE_URL: z.string().url(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    // Skip environment variable validation in Docker builds.
    skipValidation: process.env.DOCKER_BUILD === "1",
});