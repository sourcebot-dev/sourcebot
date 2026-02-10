import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    clientPrefix: "NEXT_PUBLIC_",
    client: {
        NEXT_PUBLIC_SENTRY_BACKEND_DSN: z.string().optional(),
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
        NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY: z.string().optional(),
        NEXT_PUBLIC_LANGFUSE_BASE_URL: z.string().optional(),
        NEXT_PUBLIC_BUILD_COMMIT_SHA: z.string().optional(),
    },
    runtimeEnvStrict: {
        NEXT_PUBLIC_SENTRY_BACKEND_DSN: process.env.NEXT_PUBLIC_SENTRY_BACKEND_DSN,
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
        NEXT_PUBLIC_LANGFUSE_BASE_URL: process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL,
        NEXT_PUBLIC_BUILD_COMMIT_SHA: process.env.NEXT_PUBLIC_BUILD_COMMIT_SHA,
    },
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});