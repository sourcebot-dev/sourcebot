import { describe, expect, test } from 'vitest';
import {
    compileMcpJsonSchemaValidator,
    UnsupportedMcpJsonSchemaDialectError,
    UnsupportedMcpJsonSchemaFeatureError,
} from './mcpJsonSchemaValidator';

describe('compileMcpJsonSchemaValidator', () => {
    test('uses draft-07 when it is explicitly declared', () => {
        const validate = compileMcpJsonSchemaValidator({
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'array',
            items: [{ type: 'string' }],
            additionalItems: false,
        });

        expect(validate(['valid'])).toBe(true);
        expect(validate(['valid', 'extra'])).toBe(false);
    });

    test('uses draft 2019-09 for its declared meta-schema', () => {
        const validate = compileMcpJsonSchemaValidator({
            $schema: 'https://json-schema.org/draft/2019-09/schema',
            type: 'object',
            properties: {
                known: { type: 'string' },
            },
            unevaluatedProperties: false,
        });

        expect(validate({ known: 'value' })).toBe(true);
        expect(validate({ known: 'value', extra: true })).toBe(false);
        expect(validate.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ keyword: 'unevaluatedProperties' }),
        ]));
    });

    test.each([
        ['when explicitly declared', 'https://json-schema.org/draft/2020-12/schema'],
        ['by default when omitted', undefined],
    ])('uses draft 2020-12 %s', (_name, dialect) => {
        const validate = compileMcpJsonSchemaValidator({
            ...(dialect ? { $schema: dialect } : {}),
            type: 'array',
            prefixItems: [{ type: 'string' }],
            items: false,
        });

        expect(validate(['valid'])).toBe(true);
        expect(validate([42])).toBe(false);
        expect(validate(['valid', 'extra'])).toBe(false);
    });

    test('preserves all-errors validation and permits unknown keywords', () => {
        const validate = compileMcpJsonSchemaValidator({
            type: 'object',
            required: ['first', 'second'],
            unknownServerKeyword: true,
        });

        expect(validate({})).toBe(false);
        expect(validate.errors?.filter(error => error.keyword === 'required')).toHaveLength(2);
    });

    test('does not conflict when separate server schemas reuse the same root ID', () => {
        const first = compileMcpJsonSchemaValidator({
            $id: 'https://schemas.example.com/tool-input',
            type: 'string',
        });
        const second = compileMcpJsonSchemaValidator({
            $id: 'https://schemas.example.com/tool-input',
            type: 'number',
        });

        expect(first('value')).toBe(true);
        expect(second(42)).toBe(true);
    });

    test.each([
        'http://json-schema.org/draft-07/schema#',
        'https://json-schema.org/draft/2019-09/schema',
        'https://json-schema.org/draft/2020-12/schema',
    ])('does not let a remote $id remove the %s meta-schema', (dialect) => {
        const collidingSchema = compileMcpJsonSchemaValidator({
            $schema: dialect,
            $id: dialect,
            type: 'object',
        });

        expect(collidingSchema({})).toBe(true);
        expect(() => compileMcpJsonSchemaValidator({
            $schema: dialect,
            type: 'object',
        })).not.toThrow();
    });

    test('resolves document-local 2020-12 references after compilation', () => {
        const validate = compileMcpJsonSchemaValidator({
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            $defs: {
                identifier: { type: 'string', minLength: 1 },
            },
            type: 'object',
            properties: {
                id: { $ref: '#/$defs/identifier' },
            },
            required: ['id'],
        });

        expect(validate({ id: 'issue-id' })).toBe(true);
        expect(validate({ id: '' })).toBe(false);
    });

    test('rejects Ajv asynchronous schemas instead of bypassing validation', () => {
        expect(() => compileMcpJsonSchemaValidator({
            $async: true,
            type: 'object',
        })).toThrow(UnsupportedMcpJsonSchemaFeatureError);
    });

    test.each([
        'http://json-schema.org/draft-04/schema#',
        'https://malicious.example/schema?access_token=secret-token',
    ])('rejects unsupported dialects without echoing the declaration', (declaredDialect) => {
        let thrown: unknown;
        try {
            compileMcpJsonSchemaValidator({
                $schema: declaredDialect,
                type: 'object',
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(UnsupportedMcpJsonSchemaDialectError);
        expect(thrown).toMatchObject({
            name: 'UnsupportedMcpJsonSchemaDialectError',
            reason: 'unsupported_json_schema_dialect',
        });
        expect((thrown as Error).message).not.toContain(declaredDialect);
        expect((thrown as Error).message).not.toContain('secret-token');
    });

    test('rejects a non-string declared dialect safely', () => {
        expect(() => compileMcpJsonSchemaValidator({
            $schema: 202012,
            type: 'object',
        })).toThrow(UnsupportedMcpJsonSchemaDialectError);
    });
});
