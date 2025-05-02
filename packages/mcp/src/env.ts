import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
    server: {
        SOURCEBOT_HOST: z.string().url().default("http://localhost:3000"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});