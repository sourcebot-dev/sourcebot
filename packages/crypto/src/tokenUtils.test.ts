import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@sourcebot/db';
import { getTokenFromConfig } from './tokenUtils';

// Mock the decrypt function
vi.mock('./index.js', () => ({
    decrypt: vi.fn().mockReturnValue('decrypted-secret-value')
}));

describe('tokenUtils', () => {
    let mockPrisma: any;
    const testOrgId = 1;

    beforeEach(() => {
        mockPrisma = {
            secret: {
                findUnique: vi.fn(),
            },
        };

        vi.clearAllMocks();
        delete process.env.TEST_TOKEN;
        delete process.env.EMPTY_TOKEN;
    });

    describe('getTokenFromConfig', () => {
        test('handles secret-based tokens', async () => {
            const mockSecret = { 
                iv: 'test-iv', 
                encryptedValue: 'encrypted-value' 
            };
            mockPrisma.secret.findUnique.mockResolvedValue(mockSecret);

            const config = { secret: 'my-secret' };
            const result = await getTokenFromConfig(config, testOrgId, mockPrisma);

            expect(result).toBe('decrypted-secret-value');
            expect(mockPrisma.secret.findUnique).toHaveBeenCalledWith({
                where: { 
                    orgId_key: {
                        key: 'my-secret',
                        orgId: testOrgId
                    }
                }
            });
        });

        test('handles environment variable tokens', async () => {
            process.env.TEST_TOKEN = 'env-token-value';

            const config = { env: 'TEST_TOKEN' };
            const result = await getTokenFromConfig(config, testOrgId, mockPrisma);

            expect(result).toBe('env-token-value');
        });

        test('throws error for string tokens (security)', async () => {
            const config = 'direct-string-token';

            await expect(getTokenFromConfig(config as any, testOrgId, mockPrisma))
                .rejects.toThrow('Invalid token configuration');
        });

        test('throws error for malformed token objects', async () => {
            const config = { invalid: 'format' };

            await expect(getTokenFromConfig(config as any, testOrgId, mockPrisma))
                .rejects.toThrow('Invalid token configuration');
        });

        test('throws error for missing secret', async () => {
            mockPrisma.secret.findUnique.mockResolvedValue(null);

            const config = { secret: 'non-existent-secret' };

            await expect(getTokenFromConfig(config, testOrgId, mockPrisma))
                .rejects.toThrow('Secret with key non-existent-secret not found for org 1');
        });

        test('throws error for missing environment variable', async () => {
            const config = { env: 'NON_EXISTENT_VAR' };

            await expect(getTokenFromConfig(config, testOrgId, mockPrisma))
                .rejects.toThrow('Environment variable NON_EXISTENT_VAR not found.');
        });

        test('handles empty environment variable', async () => {
            process.env.EMPTY_TOKEN = '';

            const config = { env: 'EMPTY_TOKEN' };

            await expect(getTokenFromConfig(config, testOrgId, mockPrisma))
                .rejects.toThrow('Environment variable EMPTY_TOKEN not found.');
        });
    });
});