import crypto from 'crypto';
import fs from 'fs';
import { env } from './env.js';
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