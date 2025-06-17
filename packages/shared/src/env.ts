import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { SOURCEBOT_CLOUD_ENVIRONMENT } from "./constants.js";

export const env = createEnv({
    server: {
        SOURCEBOT_EE_LICENSE_KEY: z.string().optional(),
        SOURCEBOT_PUBLIC_KEY_PATH: z.string(),
    },
    // @NOTE: Please make sure of the following:
    // - Make sure you destructure all client variables in
    //   the `runtimeEnv` block below.
    // - Update the Dockerfile to pass these variables as build-args.
    client: {
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: z.enum(SOURCEBOT_CLOUD_ENVIRONMENT).optional(),
    },
    clientPrefix: "NEXT_PUBLIC_",
    runtimeEnv: {
        ...process.env,

        // For Next.js >= 13.4.4, you need to manually destructure client variables:
        NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT: process.env.NEXT_PUBLIC_SOURCEBOT_CLOUD_ENVIRONMENT,
    },
    emptyStringAsUndefined: true,
    skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
});