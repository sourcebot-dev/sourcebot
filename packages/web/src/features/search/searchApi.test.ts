import { describe, it, expect } from 'vitest';

// Simple function to test the query transformation logic
// We'll extract just the normalization part to test it separately
const normalizeQueryOperators = (query: string): string => {
    return query
        // Replace standalone uppercase OR with lowercase or
        .replace(/\bOR\b/g, 'or')
        // Replace standalone uppercase AND with lowercase and (though AND is implicit in Zoekt)
        .replace(/\bAND\b/g, 'and');
};

describe('Query transformation', () => {
    describe('normalizeQueryOperators', () => {
        it('should convert uppercase OR to lowercase or', () => {
            expect(normalizeQueryOperators('file:yarn.lock OR file:package.json'))
                .toBe('file:yarn.lock or file:package.json');
        });

        it('should convert uppercase AND to lowercase and', () => {
            expect(normalizeQueryOperators('foo AND bar'))
                .toBe('foo and bar');
        });

        it('should handle parenthesized expressions', () => {
            expect(normalizeQueryOperators('(file:yarn.lock OR file:package.json)'))
                .toBe('(file:yarn.lock or file:package.json)');
        });

        it('should handle complex queries with multiple operators', () => {
            expect(normalizeQueryOperators('(file:*.json OR file:*.lock) AND content:react'))
                .toBe('(file:*.json or file:*.lock) and content:react');
        });

        it('should not affect lowercase operators', () => {
            expect(normalizeQueryOperators('file:yarn.lock or file:package.json'))
                .toBe('file:yarn.lock or file:package.json');
        });

        it('should not affect OR/AND when part of other words', () => {
            expect(normalizeQueryOperators('ORDER BY something'))
                .toBe('ORDER BY something');
            
            expect(normalizeQueryOperators('ANDROID app'))
                .toBe('ANDROID app');
        });

        it('should handle mixed case queries', () => {
            expect(normalizeQueryOperators('file:src OR file:test and lang:typescript'))
                .toBe('file:src or file:test and lang:typescript');
        });

        it('should handle multiple ORs and ANDs', () => {
            expect(normalizeQueryOperators('A OR B OR C AND D AND E'))
                .toBe('A or B or C and D and E');
        });
    });
});
