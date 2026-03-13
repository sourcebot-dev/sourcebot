import { env } from "./env.server.js";

export const getSMTPConnectionURL = (): string | undefined => {
    if (env.SMTP_CONNECTION_URL) {
        return env.SMTP_CONNECTION_URL;
    }
    else if (env.SMTP_HOST) {
        let smtpUrl = "smtp://";
        if (env.SMTP_USERNAME && env.SMTP_PASSWORD) {
            smtpUrl += `${env.SMTP_USERNAME}:${env.SMTP_PASSWORD}@`;
        }
        smtpUrl += env.SMTP_HOST;
        if (env.SMTP_PORT) {
            smtpUrl += `:${env.SMTP_PORT}`;
        }
        return smtpUrl;
    }
}
