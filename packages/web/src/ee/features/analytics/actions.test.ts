import { beforeEach, describe, expect, test, vi } from 'vitest';

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

beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
});

describe('getAnalytics', () => {
    test('classifies canonical and legacy MCP audit sources as MCP activity', async () => {
        await getAnalytics();

        const [queryParts, ...parameters] = mocks.queryRaw.mock.calls[0];
        const query = (queryParts as readonly string[]).join('?').replace(/\s+/g, ' ');

        expect(parameters).toContain('sourcebot-mcp-server');
        expect(parameters).toContain('mcp');
        expect(query).toContain("THEN 'mcp'");
        expect(query).toContain("WHERE c.source_category IN ('mcp', 'api')");
        expect(query).toContain("WHERE c.source_category = 'mcp'");
        expect(query).toContain("WHERE c.source_category = 'api'");
    });
});
