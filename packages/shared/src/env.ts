import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { SOURCEBOT_CLOUD_ENVIRONMENT } from "./constants.js";

export const env = createEnv({
    server: {
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_PUBLIC_KEY_PATH: z.string(),
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: z.enum(SOURCEBOT_CLOUD_ENVIRONMENT).optional(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});