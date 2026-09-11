// @vitest-environment node

import { PGlite } from '@electric-sql/pglite';
import { Prisma } from '@sourcebot/db';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    queryRaw: vi.fn(),
    findFirst: vi.fn(),
}));

vi.mock('@/middleware/sew', () => ({
    sew: (callback: () => unknown) => callback(),
}));
vi.mock('@/middleware/withAuth', () => ({
    withAuth: (callback: (context: unknown) => unknown) => callback({
        org: { id: 1 },
        role: 'OWNER',
        prisma: {
            $queryRaw: mocks.queryRaw,
            audit: { findFirst: mocks.findFirst },
        },
    }),
}));
vi.mock('@/middleware/withMinimumOrgRole', () => ({
    withMinimumOrgRole: (
        _role: unknown,
        _minimumRole: unknown,
        callback: () => unknown,
    ) => callback(),
}));
vi.mock('@/lib/entitlements', () => ({
    hasEntitlement: vi.fn().mockResolvedValue(true),
}));
vi.mock('@sourcebot/shared', () => ({
    env: { SOURCEBOT_EE_AUDIT_RETENTION_DAYS: 180 },
}));

const { getAnalytics } = await import('./actions');

const database = new PGlite();

beforeAll(async () => {
    await database.exec(`
        CREATE TABLE "Audit" (
            "timestamp" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            action text NOT NULL,
            "actorId" text NOT NULL,
            metadata jsonb,
            "orgId" integer NOT NULL
        );
    `);
});

afterAll(async () => {
    await database.close();
});

beforeEach(async () => {
    vi.clearAllMocks();
    await database.exec(`
        TRUNCATE TABLE "Audit";
        INSERT INTO "Audit" (action, "actorId", metadata, "orgId") VALUES
            ('user.performed_code_search', 'canonical-user', '{"source":"sourcebot-mcp-server"}', 1),
            ('user.fetched_file_source', 'canonical-user', '{"source":"sourcebot-mcp-server"}', 1),
            ('user.fetched_file_tree', 'legacy-user', '{"source":"mcp"}', 1),
            ('user.performed_code_search', 'api-user', '{}', 1),
            ('user.performed_code_search', 'web-user', '{"source":"sourcebot-web-client"}', 1);
    `);
    mocks.queryRaw.mockImplementation(async (queryParts: TemplateStringsArray, ...parameters: unknown[]) => {
        const query = Prisma.sql(queryParts, ...parameters as never[]);
        const result = await database.query(query.text, query.values as never[]);
        return result.rows;
    });
    mocks.findFirst.mockResolvedValue(null);
});

describe('getAnalytics', () => {
    test('classifies canonical and legacy MCP audit sources as MCP activity', async () => {
        const result = await getAnalytics();

        if ('statusCode' in result) {
            throw new Error(result.message);
        }

        const daily = result.rows.find((row) => row.period === 'day');
        expect(daily).toMatchObject({
            active_users: 4,
            web_active_users: 1,
            non_web_active_users: 3,
            mcp_requests: 3,
            mcp_active_users: 2,
            api_requests: 1,
            api_active_users: 1,
        });
    });
});
