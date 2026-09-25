import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@sourcebot/db';
import { parseQuerySyntaxIntoIR } from './parser';
import { ServiceErrorException } from '@/lib/serviceError';
import { ErrorCode } from '@/lib/errorCodes';

describe('parseQuerySyntaxIntoIR', () => {
    it('throws a ServiceErrorException when a search context is not found', async () => {
        const prisma = {
            searchContext: {
                findUnique: async () => null,
            },
        } as unknown as PrismaClient;

        const promise = parseQuerySyntaxIntoIR({
            query: 'Helpers context:0',
            options: {},
            prisma,
        });

        await expect(promise).rejects.toBeInstanceOf(ServiceErrorException);
        await expect(promise).rejects.toMatchObject({
            serviceError: { errorCode: ErrorCode.SEARCH_CONTEXT_NOT_FOUND },
        });
    });

    it('expands a search context into its repo set when found', async () => {
        const prisma = {
            searchContext: {
                findUnique: async () => ({
                    repos: [{ name: 'org/repo-a' }, { name: 'org/repo-b' }],
                }),
            },
        } as unknown as PrismaClient;

        const ir = await parseQuerySyntaxIntoIR({
            query: 'context:my-context',
            options: {},
            prisma,
        });

        expect(JSON.stringify(ir)).toContain('org/repo-a');
        expect(JSON.stringify(ir)).toContain('org/repo-b');
    });

    describe('quoted keyword terms', () => {
        const prisma = {} as unknown as PrismaClient;

        it('unescapes escaped quotes so the literal phrase is searched', async () => {
            const ir = await parseQuerySyntaxIntoIR({
                query: '"foo \\"bar\\""',
                options: {},
                prisma,
            });

            expect(ir).toMatchObject({
                query: 'substring',
                substring: { pattern: 'foo "bar"' },
            });
        });

        it('unescapes escaped backslashes', async () => {
            const ir = await parseQuerySyntaxIntoIR({
                query: '"path\\\\to\\\\file"',
                options: {},
                prisma,
            });

            expect(ir).toMatchObject({
                query: 'substring',
                substring: { pattern: 'path\\to\\file' },
            });
        });

        it('unescapes a quoted content: value', async () => {
            const ir = await parseQuerySyntaxIntoIR({
                query: 'content:"say \\"hi\\""',
                options: {},
                prisma,
            });

            expect(ir).toMatchObject({
                query: 'substring',
                substring: { pattern: 'say "hi"' },
            });
        });

        it('leaves escapes to the regex engine in regex mode', async () => {
            const ir = await parseQuerySyntaxIntoIR({
                query: '"foo \\"bar\\""',
                options: { isRegexEnabled: true },
                prisma,
            });

            expect(ir).toMatchObject({
                query: 'regexp',
                regexp: { regexp: 'foo \\"bar\\"' },
            });
        });
    });
});
