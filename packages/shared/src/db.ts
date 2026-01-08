import { env } from "./env.server.js";

export const getDBConnectionString = (): string | undefined => {
    if (env.DATABASE_URL) {
        return env.DATABASE_URL;
    }
    else if (env.DATABASE_HOST && env.DATABASE_USERNAME && env.DATABASE_PASSWORD && env.DATABASE_NAME) {
        let databaseUrl = `postgresql://${env.DATABASE_USERNAME}:${env.DATABASE_PASSWORD}@${env.DATABASE_HOST}/${env.DATABASE_NAME}`;
        if (env.DATABASE_ARGS) {
            databaseUrl += `?${env.DATABASE_ARGS}`;
        }

        return databaseUrl;
    }
}