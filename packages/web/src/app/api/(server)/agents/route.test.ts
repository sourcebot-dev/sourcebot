import { expect, test, vi, describe, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MOCK_ORG, MOCK_USER_WITH_ACCOUNTS, prisma } from '@/__mocks__/prisma';
import { AgentConfig, AgentScope, AgentType, PromptMode } from '@sourcebot/db';
import { OrgRole } from '@sourcebot/db';
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

import { GET, POST } from './route';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/agents', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

function makeDbConfig(overrides: Partial<AgentConfig> = {}): AgentConfig & { repos: []; connections: [] } {
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

// ── GET /api/agents ───────────────────────────────────────────────────────────

describe('GET /api/agents', () => {
    test('returns 200 and an empty array when no configs exist', async () => {
        prisma.agentConfig.findMany.mockResolvedValue([]);

        const res = await GET(new NextRequest('http://localhost/api/agents'));

        expect(res.status).toBe(StatusCodes.OK);
        expect(await res.json()).toEqual([]);
    });

    test('returns 200 with the list of configs', async () => {
        const configs = [makeDbConfig(), makeDbConfig({ id: 'cfg-2', name: 'second' })];
        prisma.agentConfig.findMany.mockResolvedValue(configs as any);

        const res = await GET(new NextRequest('http://localhost/api/agents'));

        expect(res.status).toBe(StatusCodes.OK);
        const body = await res.json();
        expect(body).toHaveLength(2);
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
        prisma.agentConfig.findMany.mockResolvedValue([config] as any);

        const res = await GET(new NextRequest('http://localhost/api/agents'));
        const body = await res.json();

        const repo = body[0].repos[0].repo;
        expect(repo.externalId).toBe('repo-123');
        expect(repo.externalCodeHostType).toBe('github');
        expect(repo.external_id).toBeUndefined();
        expect(repo.external_codeHostType).toBeUndefined();
    });
});

// ── POST /api/agents ──────────────────────────────────────────────────────────

describe('POST /api/agents', () => {
    describe('Zod schema validation', () => {
        test('returns 400 when name is missing', async () => {
            const res = await POST(makePostRequest({ type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when name is an empty string', async () => {
            const res = await POST(makePostRequest({ name: '', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when type is missing', async () => {
            const res = await POST(makePostRequest({ name: 'x', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when type is an invalid value', async () => {
            const res = await POST(makePostRequest({ name: 'x', type: 'UNKNOWN_TYPE', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when scope is missing', async () => {
            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when scope is an invalid value', async () => {
            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'DEPARTMENT' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });
    });

    describe('scope-specific ID validation', () => {
        test('returns 400 when scope is REPO but repoIds is not provided', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'REPO' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
            const body = await res.json();
            expect(body.message).toContain('repoIds');
        });

        test('returns 400 when scope is REPO but repoIds is an empty array', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'REPO', repoIds: [] }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('returns 400 when scope is CONNECTION but connectionIds is not provided', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'CONNECTION' }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
            const body = await res.json();
            expect(body.message).toContain('connectionIds');
        });

        test('returns 400 when scope is CONNECTION but connectionIds is an empty array', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'CONNECTION', connectionIds: [] }));

            expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        });

        test('accepts scope ORG without repoIds or connectionIds', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig() as any);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.CREATED);
        });

        test('accepts scope REPO when repoIds is a non-empty array', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.repo.count.mockResolvedValue(1);
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig({ scope: AgentScope.REPO }) as any);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'REPO', repoIds: [1] }));

            expect(res.status).toBe(StatusCodes.CREATED);
        });

        test('accepts scope CONNECTION when connectionIds is a non-empty array', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
            prisma.connection.count.mockResolvedValue(1);
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig({ scope: AgentScope.CONNECTION }) as any);

            const res = await POST(makePostRequest({ name: 'x', type: 'CODE_REVIEW', scope: 'CONNECTION', connectionIds: [2] }));

            expect(res.status).toBe(StatusCodes.CREATED);
        });
    });

    describe('scope conflict', () => {
        beforeEach(() => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
        });

        test('returns 409 when an enabled ORG-scoped config of the same type already exists', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(makeDbConfig({ id: 'cfg-conflict', name: 'existing' }) as any);

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.CONFLICT);
            const body = await res.json();
            expect(body.message).toContain('existing');
        });

        test('returns 409 when a REPO-scoped config already covers one of the provided repos', async () => {
            prisma.repo.count.mockResolvedValue(1);
            prisma.agentConfig.findFirst.mockResolvedValue(
                makeDbConfig({ id: 'cfg-conflict', name: 'repo-config', scope: AgentScope.REPO }) as any,
            );

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'REPO', repoIds: [1] }));

            expect(res.status).toBe(StatusCodes.CONFLICT);
        });

        test('returns 409 when a CONNECTION-scoped config already covers one of the provided connections', async () => {
            prisma.connection.count.mockResolvedValue(1);
            prisma.agentConfig.findFirst.mockResolvedValue(
                makeDbConfig({ id: 'cfg-conflict', name: 'conn-config', scope: AgentScope.CONNECTION }) as any,
            );

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'CONNECTION', connectionIds: [2] }));

            expect(res.status).toBe(StatusCodes.CONFLICT);
        });

        test('does not check for scope conflict when enabled is false', async () => {
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig({ enabled: false }) as any);

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'ORG', enabled: false }));

            expect(res.status).toBe(StatusCodes.CREATED);
            expect(prisma.agentConfig.findFirst).not.toHaveBeenCalled();
        });

        test('does not call create when a scope conflict is detected', async () => {
            prisma.agentConfig.findFirst.mockResolvedValue(makeDbConfig({ id: 'cfg-conflict', name: 'existing' }) as any);

            await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(prisma.agentConfig.create).not.toHaveBeenCalled();
        });
    });

    describe('name collision', () => {
        test('returns 409 when a config with the same name already exists', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(makeDbConfig() as any);

            const res = await POST(makePostRequest({ name: 'my-config', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.CONFLICT);
            const body = await res.json();
            expect(body.message).toContain('my-config');
        });

        test('does not call create when a name collision is detected', async () => {
            prisma.agentConfig.findUnique.mockResolvedValue(makeDbConfig() as any);

            await POST(makePostRequest({ name: 'my-config', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(prisma.agentConfig.create).not.toHaveBeenCalled();
        });
    });

    describe('successful creation', () => {
        beforeEach(() => {
            prisma.agentConfig.findUnique.mockResolvedValue(null);
        });

        test('returns 201 on successful creation', async () => {
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig() as any);

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'ORG' }));

            expect(res.status).toBe(StatusCodes.CREATED);
        });

        test('calls prisma.agentConfig.create with the correct data', async () => {
            prisma.agentConfig.create.mockResolvedValue(makeDbConfig() as any);

            await POST(makePostRequest({
                name: 'new-config',
                type: 'CODE_REVIEW',
                scope: 'ORG',
                prompt: 'Be strict.',
                promptMode: 'REPLACE',
                enabled: false,
            }));

            expect(prisma.agentConfig.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        orgId: MOCK_ORG.id,
                        name: 'new-config',
                        type: AgentType.CODE_REVIEW,
                        scope: AgentScope.ORG,
                        prompt: 'Be strict.',
                        promptMode: PromptMode.REPLACE,
                        enabled: false,
                    }),
                }),
            );
        });

        test('response body matches the created config', async () => {
            const created = makeDbConfig({ name: 'new-config' });
            prisma.agentConfig.create.mockResolvedValue(created as any);

            const res = await POST(makePostRequest({ name: 'new-config', type: 'CODE_REVIEW', scope: 'ORG' }));
            const body = await res.json();

            expect(body.id).toBe(created.id);
            expect(body.name).toBe('new-config');
        });

        test('serializes nested repo fields to camelCase', async () => {
            const created = {
                ...makeDbConfig({ scope: AgentScope.REPO }),
                repos: [{
                    repoId: 1,
                    agentConfigId: 'cfg-abc',
                    repo: { id: 1, displayName: 'my-repo', external_id: 'repo-123', external_codeHostType: 'github' },
                }],
            };
            prisma.repo.count.mockResolvedValue(1);
            prisma.agentConfig.findFirst.mockResolvedValue(null);
            prisma.agentConfig.create.mockResolvedValue(created as any);

            const res = await POST(makePostRequest({ name: 'repo-config', type: 'CODE_REVIEW', scope: 'REPO', repoIds: [1] }));
            const body = await res.json();

            const repo = body.repos[0].repo;
            expect(repo.externalId).toBe('repo-123');
            expect(repo.externalCodeHostType).toBe('github');
            expect(repo.external_id).toBeUndefined();
            expect(repo.external_codeHostType).toBeUndefined();
        });
    });
});
