import { expect, test, describe } from 'vitest';
import { sbChatMessageMetadataSchema, additionalChatRequestParamsSchema } from './types';

describe('sbChatMessageMetadataSchema', () => {
    test('accepts disabledMcpServerIds as array of strings', () => {
        const result = sbChatMessageMetadataSchema.safeParse({
            disabledMcpServerIds: ['id1', 'id2'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.disabledMcpServerIds).toEqual(['id1', 'id2']);
        }
    });

    test('accepts missing disabledMcpServerIds (optional)', () => {
        const result = sbChatMessageMetadataSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.disabledMcpServerIds).toBeUndefined();
        }
    });

    test('rejects non-string array values', () => {
        const result = sbChatMessageMetadataSchema.safeParse({
            disabledMcpServerIds: [123, 456],
        });

        expect(result.success).toBe(false);
    });
});

describe('additionalChatRequestParamsSchema', () => {
    const validBase = {
        languageModel: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
        },
        selectedSearchScopes: [],
    };

    test('defaults disabledMcpServerIds to empty array', () => {
        const result = additionalChatRequestParamsSchema.safeParse(validBase);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.disabledMcpServerIds).toEqual([]);
        }
    });

    test('accepts explicit disabledMcpServerIds array', () => {
        const result = additionalChatRequestParamsSchema.safeParse({
            ...validBase,
            disabledMcpServerIds: ['abc'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.disabledMcpServerIds).toEqual(['abc']);
        }
    });

    test('rejects non-array value for disabledMcpServerIds', () => {
        const result = additionalChatRequestParamsSchema.safeParse({
            ...validBase,
            disabledMcpServerIds: 'not-an-array',
        });

        expect(result.success).toBe(false);
    });
});
