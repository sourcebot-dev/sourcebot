import crypto from 'crypto';
import { SOURCEBOT_ENCRYPTION_KEY } from './environment';

const algorithm = 'aes-256-cbc';
const ivLength = 16; // 16 bytes for CBC

const generateIV = (): Buffer => {
    return crypto.randomBytes(ivLength);
};

export function encrypt(text: string): { iv: string; encryptedData: string } {
    const encryptionKey = Buffer.from(SOURCEBOT_ENCRYPTION_KEY, 'hex');

    const iv = generateIV();
    const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return { iv: iv.toString('hex'), encryptedData: encrypted };
}

export function decrypt(iv: string, encryptedText: string): string {
    const encryptionKey = Buffer.from(SOURCEBOT_ENCRYPTION_KEY, 'hex');

    const ivBuffer = Buffer.from(iv, 'hex');
    const encryptedBuffer = Buffer.from(encryptedText, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, ivBuffer);

    let decrypted = decipher.update(encryptedBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
