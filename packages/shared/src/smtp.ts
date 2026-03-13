import { env } from "./env.server.js";
import { createLogger } from "./logger.js";

const logger = createLogger("smtp");

export const getSMTPConnectionURL = (): string | undefined => {
    if (env.SMTP_CONNECTION_URL) {
        return env.SMTP_CONNECTION_URL;
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD } = env;
    if (!SMTP_HOST && !SMTP_PORT && !SMTP_USERNAME && !SMTP_PASSWORD) {
        return undefined;
    }

    const missing: string[] = [];
    if (!SMTP_HOST) missing.push("SMTP_HOST");
    if (!SMTP_PORT) missing.push("SMTP_PORT");
    if (!SMTP_USERNAME) missing.push("SMTP_USERNAME");
    if (!SMTP_PASSWORD) missing.push("SMTP_PASSWORD");

    if (missing.length > 0) {
        logger.error(`Missing required SMTP environment variables: ${missing.join(", ")}. All of SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD must be set when not using SMTP_CONNECTION_URL.`);
        return undefined;
    }

    return `smtp://${SMTP_USERNAME}:${SMTP_PASSWORD}@${SMTP_HOST}:${SMTP_PORT}`;
}
