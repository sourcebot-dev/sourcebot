import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { SOURCEBOT_CLOUD_ENVIRONMENT } from "./constants.js";
import { SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { getTokenFromConfig } from "./crypto.js";
import { loadConfig } from "./utils.js";

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);

// Numbers are treated as strings in .env files.
// coerce helps us convert them to numbers.
// @see: https://zod.dev/?id=coercion-for-primitives
const numberSchema = z.coerce.number();


const resolveEnvironmentVariableOverridesFromConfig = async (config: SourcebotConfig): Promise<Record<string, string>> => {
    if (!config.environmentOverrides) {
        return {};
    }

    const resolved: Record<string, string> = {};
    console.debug('resolving environment variable overrides');

    for (const [key, override] of Object.entries(config.environmentOverrides)) {
        switch (override.type) {
            case 'token':
                resolved[key] = await getTokenFromConfig(override.value);
                break;
            case 'boolean':
                resolved[key] = override.value ? 'true' : 'false';
                break;
            case 'number':
                resolved[key] = override.value.toString();
                break;
            case 'string':
                resolved[key] = override.value;
                break;
        }
    }

    return resolved;
}

// Merge process.env with environment variables resolved from config.json
const runtimeEnv = await (async () => {
    const configPath = process.env.CONFIG_PATH;
    if (!configPath) {
        return process.env;
    }

    const config = await loadConfig(configPath);
    const overrides = await resolveEnvironmentVariableOverridesFromConfig(config);
    return {
        ...process.env,
        ...overrides,
    }
})();

export const env = createEnv({
    server: {
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_PUBLIC_KEY_PATH: z.string(),

        SOURCEBOT_ENCRYPTION_KEY: z.string(),
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default("false"),
        SOURCEBOT_INSTALL_ID: z.string().default("unknown"),

        DATA_CACHE_DIR: z.string(),

        FALLBACK_GITHUB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITLAB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITEA_CLOUD_TOKEN: z.string().optional(),

        REDIS_URL: z.string().url().default("redis://localhost:6379"),
        REDIS_REMOVE_ON_COMPLETE: numberSchema.default(0),
        REDIS_REMOVE_ON_FAIL: numberSchema.default(100),

        DEBUG_ENABLE_GROUPMQ_LOGGING: booleanSchema.default('false'),

        DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/postgres"),
        CONFIG_PATH: z.string(),

        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: numberSchema.default(300000),
        REPO_SYNC_RETRY_BASE_SLEEP_SECONDS: numberSchema.default(60),

        GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS: numberSchema.default(60 * 10),

        EXPERIMENT_EE_PERMISSION_SYNC_ENABLED: booleanSchema.default('false'),
        AUTH_EE_GITHUB_BASE_URL: z.string().optional(),
        AUTH_EE_GITLAB_BASE_URL: z.string().default("https://gitlab.com"),

        SOURCEBOT_LOG_LEVEL: z.enum(["info", "debug", "warn", "error"]).default("info"),
        SOURCEBOT_STRUCTURED_LOGGING_ENABLED: booleanSchema.default("false"),
        SOURCEBOT_STRUCTURED_LOGGING_FILE: z.string().optional(),
        LOGTAIL_TOKEN: z.string().optional(),
        LOGTAIL_HOST: z.string().url().optional(),
    },
    client: {
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: z.enum(SOURCEBOT_CLOUD_ENVIRONMENT).optional(),
        NEXT_PUBLIC_SOURCEBOT_VERSION: z.string().default("unknown"),
        NEXT_PUBLIC_POSTHOG_PAPIK: z.string().optional(),
        NEXT_PUBLIC_SENTRY_BACKEND_DSN: z.string().optional(),
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
    },
    clientPrefix: "NEXT_PUBLIC_",
    runtimeEnv,
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});