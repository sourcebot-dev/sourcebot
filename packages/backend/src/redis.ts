import { env } from "@sourcebot/shared";
import { Redis } from 'ioredis';
import fs from "fs";

const buildTlsOptions = (): Record<string, unknown> => {
    if (env.REDIS_TLS_ENABLED !== "true" && !env.REDIS_URL.startsWith("rediss://")) {
        return {};
    }

    return {
        tls: {
            ca: env.REDIS_TLS_CA_PATH
                ? fs.readFileSync(env.REDIS_TLS_CA_PATH)
                : undefined,
            cert: env.REDIS_TLS_CERT_PATH
                ? fs.readFileSync(env.REDIS_TLS_CERT_PATH)
                : undefined,
            key: env.REDIS_TLS_KEY_PATH
                ? fs.readFileSync(env.REDIS_TLS_KEY_PATH)
                : undefined,
            ...(env.REDIS_TLS_REJECT_UNAUTHORIZED
                ? { rejectUnauthorized: env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true' }
                : {}),
            ...(env.REDIS_TLS_SERVERNAME
                ? { servername: env.REDIS_TLS_SERVERNAME }
                : {}),
            ...(env.REDIS_TLS_CHECK_SERVER_IDENTITY === "false"
                ? { checkServerIdentity: () => undefined }
                : {}),
            ...(env.REDIS_TLS_SECURE_PROTOCOL
                ? { secureProtocol: env.REDIS_TLS_SECURE_PROTOCOL }
                : {}),
            ...(env.REDIS_TLS_CIPHERS ? { ciphers: env.REDIS_TLS_CIPHERS } : {}),
            ...(env.REDIS_TLS_HONOR_CIPHER_ORDER
                ? {
                    honorCipherOrder: env.REDIS_TLS_HONOR_CIPHER_ORDER === "true",
                }
                : {}),
            ...(env.REDIS_TLS_KEY_PASSPHRASE
                ? { passphrase: env.REDIS_TLS_KEY_PASSPHRASE }
                : {}),
        },
    };
};


export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    ...buildTlsOptions(),
});
