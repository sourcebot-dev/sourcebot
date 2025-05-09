import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        GITHUB_APP_ID: z.string(),
        GITHUB_APP_WEBHOOK_SECRET: z.string(),
        GITHUB_APP_PRIVATE_KEY_PATH: z.string(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
})