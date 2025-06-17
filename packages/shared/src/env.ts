import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { SOURCEBOT_CLOUD_ENVIRONMENT } from "./constants.js";

export const env = createEnv({
    server: {
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_PUBLIC_KEY_PATH: z.string(),
    },
    client: {
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: z.enum(SOURCEBOT_CLOUD_ENVIRONMENT).optional(),
    },
    clientPrefix: "NEXT_PUBLIC_",
    runtimeEnvStrict: {
        SOURCEBOT_EE_LICENSE_KEY: process.env.SOURCEBOT_EE_LICENSE_KEY,
        SOURCEBOT_PUBLIC_KEY_PATH: process.env.SOURCEBOT_PUBLIC_KEY_PATH,
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: process.env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT,
    },
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});