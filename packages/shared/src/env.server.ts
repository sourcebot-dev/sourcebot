import { indexSchema } from "@sourcebot/schemas/v3/index.schema";
import { SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { createEnv } from "@t3-oss/env-core";
import { Ajv } from "ajv";
import { readFile } from 'fs/promises';
import stripJsonComments from "strip-json-comments";
import { z } from "zod";
import { getTokenFromConfig } from "./crypto.js";
import { tenancyModeSchema } from "./types.js";

// Booleans are specified as 'true' or 'false' strings.
const booleanSchema = z.enum(["true", "false"]);

// Numbers are treated as strings in .env files.
// coerce helps us convert them to numbers.
// @see: https://zod.dev/?id=coercion-for-primitives
const numberSchema = z.coerce.number();

const ajv = new Ajv({
    validateFormats: false,
});

export const resolveEnvironmentVariableOverridesFromConfig = async (config: SourcebotConfig): Promise<Record<string, string>> => {
    if (!config.environmentOverrides) {
        return {};
    }

    const resolved: Record<string, string> = {};

    const start = performance.now();

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

    const end = performance.now();
    console.debug(`resolved environment variable overrides in ${end - start}ms`);

    return resolved;
}

export const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

export const loadConfig = async (configPath?: string): Promise<SourcebotConfig> => {
    if (!configPath) {
        throw new Error('CONFIG_PATH is required but not provided');
    }

    const configContent = await (async () => {
        if (isRemotePath(configPath)) {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            // Retry logic for handling race conditions with mounted volumes
            const maxAttempts = 5;
            const retryDelayMs = 2000;
            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await readFile(configPath, {
                        encoding: 'utf-8',
                    });
                } catch (error) {
                    lastError = error as Error;
                    
                    // Only retry on ENOENT errors (file not found)
                    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                        throw error; // Throw immediately for non-ENOENT errors
                    }
                    
                    // Log warning before retry (except on the last attempt)
                    if (attempt < maxAttempts) {
                        console.warn(`Config file not found, retrying in 2s... (Attempt ${attempt}/${maxAttempts})`);
                        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                    }
                }
            }
            
            // If we've exhausted all retries, throw the last ENOENT error
            if (lastError) {
                throw lastError;
            }
            
            throw new Error('Failed to load config after all retry attempts');
        }
    })();

    const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfig;
    const isValidConfig = ajv.validate(indexSchema, config);
    if (!isValidConfig) {
        throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
    }
    return config;
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
        // Zoekt
        ZOEKT_WEBSERVER_URL: z.string().url().default("http://localhost:6070"),
        
        // Auth
        FORCE_ENABLE_ANONYMOUS_ACCESS: booleanSchema.default('false'),
        REQUIRE_APPROVAL_NEW_MEMBERS: booleanSchema.optional(),
        AUTH_SECRET: z.string(),
        AUTH_URL: z.string().url(),
        AUTH_CREDENTIALS_LOGIN_ENABLED: booleanSchema.default('true'),
        AUTH_EMAIL_CODE_LOGIN_ENABLED: booleanSchema.default('false'),

        // Enterprise Auth
        AUTH_EE_ALLOW_EMAIL_ACCOUNT_LINKING:
            booleanSchema
            .default('false')
            .describe('When enabled, different SSO accounts with the same email address will automatically be linked.'),

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
        // @note: this is also declared in the Dockerfile.
        POSTHOG_PAPIK: z.string().default("phc_lLPuFFi5LH6c94eFJcqvYVFwiJffVcV6HD8U4a1OnRW"),

        // Database variables
        // Either DATABASE_URL or DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD, and DATABASE_NAME must be set.
        // @see: shared/src/db.ts for more details.
        DATABASE_URL: z.string().url().optional(),
        DATABASE_HOST: z.string().optional(),
        DATABASE_USERNAME: z.string().optional(),
        DATABASE_PASSWORD: z.string().optional(),
        DATABASE_NAME: z.string().optional(),
        DATABASE_ARGS: z.string().optional(),

        SOURCEBOT_TENANCY_MODE: tenancyModeSchema.default("single"),
        CONFIG_PATH: z.string(),

        // Misc UI flags
        SECURITY_CARD_ENABLED: booleanSchema.default('false'),

        // EE License
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_EE_AUDIT_LOGGING_ENABLED: booleanSchema.default('true'),

        // GitHub app for review agent
        GITHUB_REVIEW_AGENT_APP_ID: z.string().optional(),
        GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET: z.string().optional(),
        GITHUB_REVIEW_AGENT_APP_PRIVATE_KEY_PATH: z.string().optional(),
        REVIEW_AGENT_API_KEY: z.string().optional(),
        REVIEW_AGENT_LOGGING_ENABLED: booleanSchema.default('true'),
        REVIEW_AGENT_AUTO_REVIEW_ENABLED: booleanSchema.default('false'),
        REVIEW_AGENT_REVIEW_COMMAND: z.string().default('review'),

        ANTHROPIC_API_KEY: z.string().optional(),
        ANTHROPIC_THINKING_BUDGET_TOKENS: numberSchema.default(12000),

        AZURE_API_KEY: z.string().optional(),
        AZURE_RESOURCE_NAME: z.string().optional(),

        DEEPSEEK_API_KEY: z.string().optional(),

        OPENAI_API_KEY: z.string().optional(),

        OPENROUTER_API_KEY: z.string().optional(),

        XAI_API_KEY: z.string().optional(),

        MISTRAL_API_KEY: z.string().optional(),

        GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
        GOOGLE_VERTEX_PROJECT: z.string().optional(),
        GOOGLE_VERTEX_REGION: z.string().default('us-central1'),
        GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
        GOOGLE_VERTEX_THINKING_BUDGET_TOKENS: numberSchema.default(-1),
        GOOGLE_VERTEX_INCLUDE_THOUGHTS: booleanSchema.default('true'),

        AWS_ACCESS_KEY_ID: z.string().optional(),
        AWS_SECRET_ACCESS_KEY: z.string().optional(),
        AWS_SESSION_TOKEN: z.string().optional(),
        AWS_REGION: z.string().optional(),

        SOURCEBOT_CHAT_MODEL_TEMPERATURE: numberSchema.default(0.3),
        SOURCEBOT_CHAT_MAX_STEP_COUNT: numberSchema.default(20),

        DEBUG_WRITE_CHAT_MESSAGES_TO_FILE: booleanSchema.default('false'),

        LANGFUSE_SECRET_KEY: z.string().optional(),

        SOURCEBOT_DEMO_EXAMPLES_PATH: z.string().optional(),

        // Experimental Environment Variables
        // @note: These environment variables are subject to change at any time and are not garunteed to be backwards compatible.
        EXPERIMENT_DISABLE_API_KEY_CREATION_FOR_NON_ADMIN_USERS: booleanSchema.default('false'),
        EXPERIMENT_SELF_SERVE_REPO_INDEXING_ENABLED: booleanSchema.default('false'),
        // @NOTE: Take care to update actions.ts when changing the name of this.
        EXPERIMENT_SELF_SERVE_REPO_INDEXING_GITHUB_TOKEN: z.string().optional(),
        EXPERIMENT_EE_PERMISSION_SYNC_ENABLED: booleanSchema.default('false'),
        EXPERIMENT_ASK_GH_ENABLED: booleanSchema.default('false'),

        SOURCEBOT_ENCRYPTION_KEY: z.string(),
        SOURCEBOT_INSTALL_ID: z.string().default("unknown"),

        FALLBACK_GITHUB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITLAB_CLOUD_TOKEN: z.string().optional(),
        FALLBACK_GITEA_CLOUD_TOKEN: z.string().optional(),

        REDIS_URL: z.string().url().default("redis://localhost:6379"),
        REDIS_REMOVE_ON_COMPLETE: numberSchema.default(0),
        REDIS_REMOVE_ON_FAIL: numberSchema.default(100),

        CONNECTION_MANAGER_UPSERT_TIMEOUT_MS: numberSchema.default(300000),
        REPO_SYNC_RETRY_BASE_SLEEP_SECONDS: numberSchema.default(60),

        GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS: numberSchema.default(60 * 10),

        SOURCEBOT_LOG_LEVEL: z.enum(["info", "debug", "warn", "error"]).default("info"),
        SOURCEBOT_STRUCTURED_LOGGING_ENABLED: booleanSchema.default("false"),
        SOURCEBOT_STRUCTURED_LOGGING_FILE: z.string().optional(),

        // Configure the default maximum number of search results to return by default.
        DEFAULT_MAX_MATCH_COUNT: numberSchema.default(10_000),

        // A comma separated list of glob patterns that shwould always be indexed regardless of their size.
        ALWAYS_INDEX_FILE_PATTERNS: z.string().optional(),

        /**
         * Configure whether to send telemetry events.
         * By default, all events are anonymized and do not contain PII data,
         * unless SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED is set to true.
         */
        SOURCEBOT_TELEMETRY_DISABLED: booleanSchema.default('false'),

        /**
         * Configure whether to collect PII data in telemetry events.
         * If SOURCEBOT_TELEMETRY_DISABLED is true, this setting is
         * ignored.
         */
        SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED: booleanSchema.default('false'),

        //// DEPRECATED ////

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITHUB_CLIENT_ID: z.string().optional(),
        
        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITHUB_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITHUB_BASE_URL: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITLAB_CLIENT_ID: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITLAB_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GITLAB_BASE_URL: z.string().default("https://gitlab.com"),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GOOGLE_CLIENT_ID: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_GOOGLE_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_OKTA_CLIENT_ID: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_OKTA_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_OKTA_ISSUER: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_KEYCLOAK_CLIENT_ID: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_KEYCLOAK_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_KEYCLOAK_ISSUER: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_ID: z.string().optional(),

        /**
         * @deprecated
         * This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_MICROSOFT_ENTRA_ID_CLIENT_SECRET: z.string().optional(),

        /**
         * @deprecated This setting is deprecated. Please use the `identityProviders` section of the config file instead.
         */
        AUTH_EE_MICROSOFT_ENTRA_ID_ISSUER: z.string().optional(),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});