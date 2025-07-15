import { describe, test, expect, beforeEach } from 'vitest';
import Ajv from 'ajv';
import { sharedSchema } from './shared.schema';

describe('shared schema validation', () => {
    let ajv: Ajv;

    beforeEach(() => {
        ajv = new Ajv({ strict: false });
    });

    describe('Token validation', () => {
        test('accepts valid secret token format', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const validToken = { secret: 'my-secret-name' };
            const isValid = validate(validToken);

            expect(isValid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('accepts valid environment variable token format', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const validToken = { env: 'MY_TOKEN_VAR' };
            const isValid = validate(validToken);

            expect(isValid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('rejects string tokens (security measure)', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const stringToken = 'direct-string-token';
            const isValid = validate(stringToken);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
            expect(validate.errors![0].message).toContain('must be object');
        });

        test('rejects empty string tokens', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const emptyStringToken = '';
            const isValid = validate(emptyStringToken);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });

        test('rejects malformed token objects', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const malformedToken = { invalid: 'format' };
            const isValid = validate(malformedToken);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });

        test('rejects token objects with both secret and env', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const invalidToken = { secret: 'my-secret', env: 'MY_VAR' };
            const isValid = validate(invalidToken);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });

        test('rejects empty secret name (security measure)', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const tokenWithEmptySecret = { secret: '' };
            const isValid = validate(tokenWithEmptySecret);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });

        test('rejects empty environment variable name (security measure)', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const tokenWithEmptyEnv = { env: '' };
            const isValid = validate(tokenWithEmptyEnv);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });

        test('rejects token objects with additional properties', () => {
            const tokenSchema = sharedSchema.definitions!.Token;
            const validate = ajv.compile(tokenSchema);

            const invalidToken = { secret: 'my-secret', extra: 'property' };
            const isValid = validate(invalidToken);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });
    });

    describe('GitRevisions validation', () => {
        test('accepts valid GitRevisions object', () => {
            const revisionsSchema = sharedSchema.definitions!.GitRevisions;
            const validate = ajv.compile(revisionsSchema);

            const validRevisions = {
                branches: ['main', 'develop'],
                tags: ['v1.0.0', 'latest']
            };
            const isValid = validate(validRevisions);

            expect(isValid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('accepts empty GitRevisions object', () => {
            const revisionsSchema = sharedSchema.definitions!.GitRevisions;
            const validate = ajv.compile(revisionsSchema);

            const emptyRevisions = {};
            const isValid = validate(emptyRevisions);

            expect(isValid).toBe(true);
            expect(validate.errors).toBeNull();
        });

        test('rejects GitRevisions with additional properties', () => {
            const revisionsSchema = sharedSchema.definitions!.GitRevisions;
            const validate = ajv.compile(revisionsSchema);

            const invalidRevisions = {
                branches: ['main'],
                tags: ['v1.0.0'],
                invalid: 'property'
            };
            const isValid = validate(invalidRevisions);

            expect(isValid).toBe(false);
            expect(validate.errors).toBeTruthy();
        });
    });
});