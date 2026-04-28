import { expect, test, vi, describe, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { resolveAgentConfig } from './resolveAgentConfig';
import { AgentConfig, AgentScope, AgentType, PrismaClient, PromptMode } from '@sourcebot/db';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

const prisma = mockDeep<PrismaClient>();

beforeEach(() => {
    mockReset(prisma);
});

function makeConfig(scope: AgentScope, overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
        id: 'cfg-1',
        orgId: 1,
        name: 'test-config',
        description: null,
        type: AgentType.CODE_REVIEW,
        enabled: true,
        prompt: null,
        promptMode: PromptMode.APPEND,
        scope,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

describe('resolveAgentConfig', () => {
    describe('priority chain', () => {
        test('returns REPO-scoped config when one matches', async () => {
            const cfg = makeConfig(AgentScope.REPO);
            prisma.agentConfig.findFirst.mockResolvedValueOnce(cfg);

            const result = await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(result).toEqual(cfg);
        });

        test('falls back to CONNECTION-scoped when there is no REPO match', async () => {
            const cfg = makeConfig(AgentScope.CONNECTION);
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(null)  // REPO miss
                .mockResolvedValueOnce(cfg);  // CONNECTION hit

            const result = await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(result).toEqual(cfg);
        });

        test('falls back to ORG-scoped when there is no REPO or CONNECTION match', async () => {
            const cfg = makeConfig(AgentScope.ORG);
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(null)  // REPO miss
                .mockResolvedValueOnce(null)  // CONNECTION miss
                .mockResolvedValueOnce(cfg);  // ORG hit

            const result = await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(result).toEqual(cfg);
        });

        test('returns null when no config matches any scope', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            const result = await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(result).toBeNull();
        });

        test('stops after the first match and does not query further scopes', async () => {
            prisma.agentConfig.findFirst.mockResolvedValueOnce(makeConfig(AgentScope.REPO));

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenCalledTimes(1);
        });

        test('queries CONNECTION scope after a REPO miss, then stops', async () => {
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(makeConfig(AgentScope.CONNECTION));

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenCalledTimes(2);
        });

        test('queries all three scopes when REPO and CONNECTION both miss', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenCalledTimes(3);
        });
    });

    describe('query filters', () => {
        test('REPO query filters by the given repoId', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            await resolveAgentConfig(42, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: expect.objectContaining({
                        scope: 'REPO',
                        repos: { some: { repoId: 42 } },
                    }),
                }),
            );
        });

        test('all queries filter by the given orgId', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            await resolveAgentConfig(10, 99, AgentType.CODE_REVIEW, prisma);

            for (const call of prisma.agentConfig.findFirst.mock.calls) {
                expect(call[0]).toMatchObject({ where: { orgId: 99 } });
            }
        });

        test('all queries filter by the given AgentType', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            for (const call of prisma.agentConfig.findFirst.mock.calls) {
                expect(call[0]).toMatchObject({ where: { type: AgentType.CODE_REVIEW } });
            }
        });

        test('all queries only consider enabled configs', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            for (const call of prisma.agentConfig.findFirst.mock.calls) {
                expect(call[0]).toMatchObject({ where: { enabled: true } });
            }
        });

        test('CONNECTION query traverses the repo→connection relationship', async () => {
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            await resolveAgentConfig(7, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: expect.objectContaining({
                        scope: 'CONNECTION',
                        connections: {
                            some: {
                                connection: {
                                    repos: { some: { repoId: 7 } },
                                },
                            },
                        },
                    }),
                }),
            );
        });

        test('ORG query uses ORG scope', async () => {
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);

            await resolveAgentConfig(10, 1, AgentType.CODE_REVIEW, prisma);

            expect(prisma.agentConfig.findFirst).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({
                    where: expect.objectContaining({ scope: 'ORG' }),
                }),
            );
        });
    });
});
