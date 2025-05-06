import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const numberSchema = z.coerce.number();

export const env = createEnv({
    server: {
        SOURCEBOT_HOST: z.string().url().default("http://localhost:3000"),

        // The minimum number of tokens to return
        DEFAULT_MINIMUM_TOKENS: numberSchema.default(10000),

        // The number of matches to fetch from the search API.
        DEFAULT_MATCHES: numberSchema.default(10000),

        // The number of lines to include above and below a match
        DEFAULT_CONTEXT_LINES: numberSchema.default(5),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});