import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@sourcebot/db';
import { parseQuerySyntaxIntoIR } from './parser';

describe('parseQuerySyntaxIntoIR', () => {
    it('resolves anchored repo display names to repo_set queries', async () => {
        const findMany = vi.fn().mockResolvedValue([
            { name: 'gerrit.example.com:29418/zximgw/rcsiap2001' },
        ]);

        const prisma = {
            repo: {
                findMany,
            },
        } as unknown as PrismaClient;

        const query = await parseQuerySyntaxIntoIR({
            query: 'repo:"^zximgw/rcsiap2001$"',
            options: {},
            prisma,
        });

        expect(findMany).toHaveBeenCalledWith({
            where: {
                orgId: expect.any(Number),
                OR: [
                    { name: 'zximgw/rcsiap2001' },
                    { displayName: 'zximgw/rcsiap2001' },
                ],
            },
            select: { name: true },
        });

        expect(query.repo_set).toBeDefined();
        expect(query.repo_set?.set).toEqual({
            'gerrit.example.com:29418/zximgw/rcsiap2001': true,
        });
    });

    it('falls back to regex handling when pattern is not a literal string', async () => {
        const findMany = vi.fn();
        const prisma = {
            repo: {
                findMany,
            },
        } as unknown as PrismaClient;

        const query = await parseQuerySyntaxIntoIR({
            query: 'repo:^gerrit.*$',
            options: {},
            prisma,
        });

        expect(findMany).not.toHaveBeenCalled();
        expect(query.repo?.regexp).toEqual('^gerrit.*$');
    });
});
