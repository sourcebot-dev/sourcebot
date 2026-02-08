import crypto from 'crypto';
import fs from 'fs';
import { z } from 'zod';
import { env } from './env.server.js';
import { Token } from '@sourcebot/schemas/v3/shared.type';
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const algorithm = 'aes-256-cbc';
const ivLength = 16; // 16 bytes for CBC

const publicKeyCache = new Map<string, string>();

const generateIV = (): Buffer => {
    return crypto.randomBytes(ivLength);
};

export function encrypt(text: string): { iv: string; encryptedData: string } {
    const encryptionKey = Buffer.from(env.SOURCEBOT_ENCRYPTION_KEY, 'ascii');

    const iv = generateIV();
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return { iv: iv.toString('hex'), encryptedData: encrypted };
}

export function hashSecret(text: string): string {
    return crypto.createHmac('sha256', env.SOURCEBOT_ENCRYPTION_KEY).update(text).digest('hex');
}

export function generateApiKey(): { key: string; hash: string } {
    const secret = crypto.randomBytes(32).toString('hex');
    const hash = hashSecret(secret);

    return {
        key: `sourcebot-${secret}`,
        hash,
    };
}

export function decrypt(iv: string, encryptedText: string): string {
    const encryptionKey = Buffer.from(env.SOURCEBOT_ENCRYPTION_KEY, 'ascii');

    const ivBuffer = Buffer.from(iv, 'hex');
    const encryptedBuffer = Buffer.from(encryptedText, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, ivBuffer);

    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function verifySignature(data: string, signature: string, publicKeyPath: string): boolean {
    try {
        let publicKey = publicKeyCache.get(publicKeyPath);
        
        if (!publicKey) {
            if (!fs.existsSync(publicKeyPath)) {
                throw new Error(`Public key file not found at: ${publicKeyPath}`);
            }
            
            publicKey = fs.readFileSync(publicKeyPath, 'utf8');
            publicKeyCache.set(publicKeyPath, publicKey);
        }
        
        // Convert base64url signature to base64 if needed
        const base64Signature = signature.replace(/-/g, '+').replace(/_/g, '/');
        const paddedSignature = base64Signature + '='.repeat((4 - base64Signature.length % 4) % 4);
        const signatureBuffer = Buffer.from(paddedSignature, 'base64');
        
        return crypto.verify(null, Buffer.from(data, 'utf8'), publicKey, signatureBuffer);
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

export const getTokenFromConfig = async (token: Token): Promise<string> => {
    if ('env' in token) {
        const envToken = process.env[token.env];
        if (!envToken) {
            throw new Error(`Environment variable ${token.env} not found.`);
        }

        return envToken;
    } else if ('googleCloudSecret' in token) {
        try {
            const client = new SecretManagerServiceClient();
            const [response] = await client.accessSecretVersion({
                name: token.googleCloudSecret,
            });

            if (!response.payload?.data) {
                throw new Error(`Secret ${token.googleCloudSecret} not found.`);
            }

            return response.payload.data.toString();
        } catch (error) {
            throw new Error(`Failed to access Google Cloud secret ${token.googleCloudSecret}: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else {
        throw new Error('Invalid token configuration');
    }
}; 

// OAuth Token Encryption using AUTH_SECRET
// Encrypts OAuth tokens (access_token, refresh_token, id_token) before database storage.
// Supports automatic migration from plaintext by detecting and handling both encrypted and plaintext tokens.

const oauthAlgorithm = 'aes-256-gcm';
const oauthIvLength = 16;
const oauthSaltLength = 64;

/**
 * Schema for encrypted OAuth token structure.
 * Stored as base64-encoded JSON in the database.
 */
const encryptedOAuthTokenSchema = z.object({
    v: z.literal(1), // Version for future format changes
    salt: z.string(), // hex-encoded salt for key derivation
    iv: z.string(),   // hex-encoded initialization vector
    tag: z.string(),  // hex-encoded auth tag
    data: z.string(), // hex-encoded encrypted data
});

type EncryptedOAuthToken = z.infer<typeof encryptedOAuthTokenSchema>;

function deriveOAuthKey(authSecret: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(authSecret, salt, 100000, 32, 'sha256');
}

function isOAuthTokenEncrypted(token: string): boolean {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        return encryptedOAuthTokenSchema.safeParse(parsed).success;
    } catch {
        return false;
    }
}

/**
 * Encrypts OAuth token using AUTH_SECRET. Idempotent - returns token unchanged if already encrypted.
 */
export function encryptOAuthToken(text: string | null | undefined): string | undefined {
    if (!text) {
        return undefined;
    }

    if (isOAuthTokenEncrypted(text)) {
        return text;
    }

    const iv = crypto.randomBytes(oauthIvLength);
    const salt = crypto.randomBytes(oauthSaltLength);
    const key = deriveOAuthKey(env.AUTH_SECRET, salt);

    const cipher = crypto.createCipheriv(oauthAlgorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const tokenData: EncryptedOAuthToken = {
        v: 1,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted.toString('hex'),
    };

    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

/**
 * Decrypts OAuth token using AUTH_SECRET. Returns plaintext tokens unchanged during migration.
 */
export function decryptOAuthToken(encryptedText: string | null | undefined): string | undefined {
    if (!encryptedText) {
        return undefined;
    }

    if (!isOAuthTokenEncrypted(encryptedText)) {
        return encryptedText;
    }

    try {
        const decoded = Buffer.from(encryptedText, 'base64').toString('utf8');
        const tokenData = encryptedOAuthTokenSchema.parse(JSON.parse(decoded));

        const salt = Buffer.from(tokenData.salt, 'hex');
        const iv = Buffer.from(tokenData.iv, 'hex');
        const tag = Buffer.from(tokenData.tag, 'hex');
        const encrypted = Buffer.from(tokenData.data, 'hex');

        const key = deriveOAuthKey(env.AUTH_SECRET, salt);
        const decipher = crypto.createDecipheriv(oauthAlgorithm, key, iv);
        decipher.setAuthTag(tag);

        return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
    } catch {
        // Decryption failed - likely a plaintext token, return as-is
        return encryptedText;
    }
}
