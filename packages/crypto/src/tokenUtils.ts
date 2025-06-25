import { PrismaClient } from "@sourcebot/db";
import { Token } from "@sourcebot/schemas/v3/shared.type";
import { decrypt } from "./index.js";

export const getTokenFromConfig = async (token: Token, orgId: number, db: PrismaClient) => {
    // Handle direct string tokens
    if (typeof token === 'string') {
        return token;
    }
    
    if ('secret' in token) {
        const secretKey = token.secret;
        const secret = await db.secret.findUnique({
            where: {
                orgId_key: {
                    key: secretKey,
                    orgId
                }
            }
        });

        if (!secret) {
            throw new Error(`Secret with key ${secretKey} not found for org ${orgId}`);
        }

        const decryptedToken = decrypt(secret.iv, secret.encryptedValue);
        return decryptedToken;
    } else if ('env' in token) {
        const envToken = process.env[token.env];
        if (!envToken) {
            throw new Error(`Environment variable ${token.env} not found.`);
        }

        return envToken;
    } else {
        throw new Error('Invalid token configuration');
    }
}; 