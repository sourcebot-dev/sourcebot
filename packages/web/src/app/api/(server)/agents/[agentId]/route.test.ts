import { expect, test, vi, describe, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MOCK_ORG, MOCK_USER_WITH_ACCOUNTS, prisma } from '@/__mocks__/prisma';
import { AgentConfig, AgentScope, AgentType, OrgRole, PromptMode } from '@sourcebot/db';
import { StatusCodes } from 'http-status-codes';

vi.mock('@/prisma', async () => {
    const actual = await vi.importActual<typeof import('@/__mocks__/prisma')>('@/__mocks__/prisma');
    return { ...actual };
});

vi.mock('server-only', () => ({ default: vi.fn() }));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    env: {},
}));

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn(async (fn: Function) =>
        fn({ org: MOCK_ORG, user: MOCK_USER_WITH_ACCOUNTS, role: OrgRole.OWNER, prisma })
    ),
}));

// app.ts imports heavy node deps — provide a real Zod schema so updateAgentConfigBodySchema.safeParse works.
vi.mock('@/features/agents/review-agent/app', async () => {
    const { z } = await import('zod');
    return {
        agentConfigSettingsSchema: z.object({
            autoReviewEnabled: z.boolean().optional(),
            reviewCommand: z.string().optional(),
            model: z.string().optional(),
            contextFiles: z.string().optional(),
        }),
    };
});

import { GET, PATCH, DELETE } from './route';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeUrl(agentId: string): string {
    return `http://localhost/api/agents/${agentId}`;
}

function makePatchRequest(agentId: string, body: unknown): NextRequest {
    return new NextRequest(makeUrl(agentId), {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

function makeGetRequest(agentId: string): NextRequest {
    return new NextRequest(makeUrl(agentId), { method: 'GET' });
}

function makeDeleteRequest(agentId: string): NextRequest {
    return new NextRequest(makeUrl(agentId), { method: 'DELETE' });
}

type DbConfigOverrides = Partial<AgentConfig> & {
    repos?: { repoId: number }[];
    connections?: { connectionId: number }[];
};

function makeDbConfig(overrides: DbConfigOverrides = {}): AgentConfig & { repos: { repoId: number }[]; connections: { connectionId: number }[] } {
    return {
        id: 'cfg-abc',
        orgId: MOCK_ORG.id,
        name: 'my-config',
        description: null,
        type: AgentType.CODE_REVIEW,
        enabled: true,
        prompt: null,
        promptMode: PromptMode.APPEND,
        scope: AgentScope.ORG,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        repos: [],
        connections: [],
        ...overrides,
    };
}

// ── GET /api/agents/[agentId] ─────────────────────────────────────────────────

describe('GET /api/agents/[agentId]', () => {
    test('returns 404 when config does not exist', async () => {
        prisma.agentConfig.findFirst.mockResolvedValue(null);

        const res = await GET(makeGetRequest('cfg-missing'), { params: Promise.resolve({ agentId: 'cfg-missing' }) });

        expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    test('returns 200 with the config when found', async () => {
        prisma.agentConfig.findFirst.mockResolvedValue(makeDbConfig() as any);

        const res = await GET(makeGetRequest('cfg-abc'), { params: Promise.resolve({ agentId: 'cfg-abc' }) });

        expect(res.status).toBe(StatusCodes.OK);
        const body = await res.json();
        expect(body.id).toBe('cfg-abc');
    });

    test('serializes nested repo fields to camelCase', async () => {
        const config = {
            ...makeDbConfig(),
            repos: [{
                repoId: 1,
                agentConfigId: 'cfg-abc',
                repo: { id: 1, displayName: 'my-repo', external_id: 'repo-123', external_codeHostType: 'github' },
            }],
        };
        prisma.agentConfig.findFirst.mockResolvedValue(config as any);

        const res = await GET(makeGetRequest('cfg-abc'), { params: Promise.resolve({ agentId: 'cfg-abc' }) });
        const body = await res.json();

        const repo = body.repos[0].repo;
        expect(repo.externalId).toBe('repo-123');
        expect(repo.externalCodeHostType).toBe('github');
        expect(repo.external_id).toBeUndefined();
        expect(repo.external_codeHostType).toBeUndefined();
    });
});

// ── PATCH /api/agents/[agentId] ───────────────────────────────────────────────

describe('PATCH /api/agents/[agentId]', () => {
    const AGENT_ID = 'cfg-abc';
    const params = { params: Promise.resolve({ agentId: AGENT_ID }) };

    describe('not found', () => {
        test('returns 404 when the config does not exist', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(null);

            const res = await PATCH(makePatchRequest(AGENT_ID, { name: 'new-name' }), params);

            expect(res.status).toBe(StatusCodes.NOT_FOUND);
        });
    });

    describe('name collision', () => {
        beforeEach(() => {
            // First findFirst: fetch existing config. Subsequent calls (scope conflict): no conflict.
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(makeDbConfig() as any)
                .mockResolvedValue(null);
        });

        test('returns 409 when renaming to a name used by another config', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(makeDbConfig({ id: 'cfg-other', name: 'taken-name' }) as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { name: 'taken-name' }), params);

            expect(res.status).toBe(StatusCodes.CONFLICT);
            const body = await res.json();
            expect(body.message).toContain('taken-name');
        });

        test('does not call update when a name collision is detected', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(makeDbConfig({ id: 'cfg-other' }) as any);

            await PATCH(makePatchRequest(AGENT_ID, { name: 'taken-name' }), params);

            expect(prisma.agentConfig.update).not.toHaveBeenCalled();
        });

        test('returns 200 when renaming to the same name the config already has', async () => {
            // No collision — the config has name 'my-config' and we're "renaming" to the same value.
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig() as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { name: 'my-config' }), params);

            expect(res.status).toBe(StatusCodes.OK);
        });

        test('does not query for collision when name is not in the patch body', async () => {
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig() as any);

            await PATCH(makePatchRequest(AGENT_ID, { enabled: false }), params);

            expect(prisma.agentConfig.findUnique).not.toHaveBeenCalled();
        });

        test('returns 200 when renaming to a free name', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig({ name: 'free-name' }) as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { name: 'free-name' }), params);

            expect(res.status).toBe(StatusCodes.OK);
        });
    });

    describe('successful update', () => {
        beforeEach(() => {
            // First findFirst: fetch existing config. Subsequent calls (scope conflict): no conflict.
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(makeDbConfig() as any)
                .mockResolvedValue(null);
            prisma.agentConfig.findUnique.mockResolvedValue(null);
        });

        test('returns 200 on a valid patch', async () => {
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig({ enabled: false }) as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { enabled: false }), params);

            expect(res.status).toBe(StatusCodes.OK);
        });

        test('calls prisma.agentConfig.update with the patched fields', async () => {
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig() as any);

            await PATCH(makePatchRequest(AGENT_ID, { enabled: false, prompt: 'Be strict.' }), params);

            expect(prisma.agentConfig.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        enabled: false,
                        prompt: 'Be strict.',
                    }),
                }),
            );
        });

        test('serializes nested repo fields to camelCase', async () => {
            const updated = {
                ...makeDbConfig({ scope: AgentScope.REPO }),
                repos: [{
                    repoId: 1,
                    agentConfigId: 'cfg-abc',
                    repo: { id: 1, displayName: 'my-repo', external_id: 'repo-123', external_codeHostType: 'github' },
                }],
            };
            prisma.agentConfig.update.mockResolvedValue(updated as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { enabled: false }), params);
            const body = await res.json();

            const repo = body.repos[0].repo;
            expect(repo.externalId).toBe('repo-123');
            expect(repo.externalCodeHostType).toBe('github');
            expect(repo.external_id).toBeUndefined();
            expect(repo.external_codeHostType).toBeUndefined();
        });
    });

    describe('scope conflict', () => {
        const params = { params: Promise.resolve({ agentId: AGENT_ID }) };

        test('returns 409 when patching an ORG config conflicts with another enabled org-wide config', async () => {
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(makeDbConfig() as any)                                         // existing
                .mockResolvedValueOnce(makeDbConfig({ id: 'cfg-other', name: 'conflicting' }) as any); // scope conflict
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await PATCH(makePatchRequest(AGENT_ID, { name: 'renamed' }), params);

            expect(res.status).toBe(StatusCodes.CONFLICT);
            const body = await res.json();
            expect(body.message).toContain('conflicting');
        });

        test('does not call update when a scope conflict is detected', async () => {
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(makeDbConfig() as any)
                .mockResolvedValueOnce(makeDbConfig({ id: 'cfg-other', name: 'conflicting' }) as any);
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            await PATCH(makePatchRequest(AGENT_ID, { name: 'renamed' }), params);

            expect(prisma.agentConfig.update).not.toHaveBeenCalled();
        });

        test('returns 409 when a REPO config overlaps with another enabled REPO config', async () => {
            const existingRepoConfig = makeDbConfig({
                scope: AgentScope.REPO,
                repos: [{ repoId: 5 }] as any,
            });
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(existingRepoConfig as any)
                .mockResolvedValueOnce(makeDbConfig({ id: 'cfg-other', name: 'conflicting', scope: AgentScope.REPO }) as any);
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await PATCH(makePatchRequest(AGENT_ID, { prompt: 'updated' }), params);

            expect(res.status).toBe(StatusCodes.CONFLICT);
        });

        test('returns 409 when a CONNECTION config overlaps with another enabled CONNECTION config', async () => {
            const existingConnConfig = makeDbConfig({
                scope: AgentScope.CONNECTION,
                connections: [{ connectionId: 7 }] as any,
            });
            prisma.agentConfig.findFirst
                .mockResolvedValueOnce(existingConnConfig as any)
                .mockResolvedValueOnce(makeDbConfig({ id: 'cfg-other', name: 'conflicting', scope: AgentScope.CONNECTION }) as any);
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await PATCH(makePatchRequest(AGENT_ID, { prompt: 'updated' }), params);

            expect(res.status).toBe(StatusCodes.CONFLICT);
        });

        test('does not check scope conflict when patching enabled to false', async () => {
            prisma.agentConfig.findFirst.mockResolvedValueOnce(makeDbConfig() as any);
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.agentConfig.update.mockResolvedValue(makeDbConfig({ enabled: false }) as any);

            const res = await PATCH(makePatchRequest(AGENT_ID, { enabled: false }), params);

            expect(res.status).toBe(StatusCodes.OK);
            expect(prisma.agentConfig.findFirst).toHaveBeenCalledTimes(1);
        });
    });
});

// ── DELETE /api/agents/[agentId] ──────────────────────────────────────────────

describe('DELETE /api/agents/[agentId]', () => {
    const AGENT_ID = 'cfg-abc';
    const params = { params: Promise.resolve({ agentId: AGENT_ID }) };

    test('returns 404 when the config does not exist', async () => {
        prisma.agentConfig.findFirst.mockResolvedValue(null);

        const res = await DELETE(makeDeleteRequest(AGENT_ID), params);

        expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    test('returns 200 and calls delete when the config exists', async () => {
        prisma.agentConfig.findFirst.mockResolvedValue(makeDbConfig() as any);
        prisma.agentConfig.delete.mockResolvedValue(makeDbConfig() as any);

        const res = await DELETE(makeDeleteRequest(AGENT_ID), params);

        expect(res.status).toBe(StatusCodes.OK);
        expect(prisma.agentConfig.delete).toHaveBeenCalledWith({ where: { id: AGENT_ID } });
    });
});
