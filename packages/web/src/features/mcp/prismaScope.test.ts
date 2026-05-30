import { describe, expect, test, vi } from 'vitest';
import type { UserWithAccounts } from '@sourcebot/db';
import { getMcpPrismaQueryExtension, scopeUserMcpServerWhere } from './prismaScope';

const user = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    hashedPassword: null,
    emailVerified: null,
    image: null,
    sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    accounts: [],
} satisfies UserWithAccounts;

const callQuery = vi.fn(async (args: unknown) => args);

const resetQuery = () => {
    callQuery.mockClear();
    return callQuery;
};

const callAllOperations = (
    model: {
        $allOperations: (params: {
            operation: string;
            args: unknown;
            query: (args: unknown) => Promise<unknown>;
        }) => Promise<unknown>;
    },
    operation: string,
    args: unknown,
    query = resetQuery(),
) => model.$allOperations({ operation, args, query });

describe('scopeUserMcpServerWhere', () => {
    test('merges existing filters with the authenticated user id', () => {
        expect(scopeUserMcpServerWhere({ tokens: { not: null } }, user)).toEqual({
            AND: [
                { tokens: { not: null } },
                { userId: 'user-1' },
            ],
        });
    });

    test('fails closed for anonymous users', () => {
        expect(scopeUserMcpServerWhere(undefined, undefined)).toEqual({
            AND: [
                { userId: '__sourcebot_anonymous_user__' },
                { userId: '__sourcebot_no_authenticated_user__' },
            ],
        });
    });
});

describe('getMcpPrismaQueryExtension', () => {
    test('scopes list-style UserMcpServer reads', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const result = await extension.userMcpServer.findMany({
            args: { where: { tokens: { not: null } } },
            query: resetQuery(),
        });

        expect(result).toEqual({
            where: {
                AND: [
                    { tokens: { not: null } },
                    { userId: 'user-1' },
                ],
            },
        });
    });

    test('returns null for anonymous or mismatched findUnique queries', async () => {
        const anonymousExtension = getMcpPrismaQueryExtension();
        const mismatchedExtension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(anonymousExtension.userMcpServer.findUnique({
            args: { where: { userId_serverId: { userId: 'user-1', serverId: 'server-1' } } },
            query,
        })).resolves.toBeNull();
        await expect(mismatchedExtension.userMcpServer.findUnique({
            args: { where: { userId_serverId: { userId: 'user-2', serverId: 'server-1' } } },
            query,
        })).resolves.toBeNull();

        expect(query).not.toHaveBeenCalled();
    });

    test('allows matching findUnique queries through', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const args = { where: { userId_serverId: { userId: 'user-1', serverId: 'server-1' } } };

        await expect(extension.userMcpServer.findUnique({
            args,
            query: resetQuery(),
        })).resolves.toBe(args);
    });

    test('rejects creates for anonymous or mismatched users', async () => {
        const anonymousExtension = getMcpPrismaQueryExtension();
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(anonymousExtension.userMcpServer.create({
            args: { data: { userId: 'user-1', serverId: 'server-1' } },
            query,
        })).rejects.toThrow('requires an authenticated user');
        await expect(extension.userMcpServer.create({
            args: { data: { userId: 'user-2', serverId: 'server-1' } },
            query,
        })).rejects.toThrow('must create UserMcpServer rows for the authenticated user');

        expect(query).not.toHaveBeenCalled();
    });

    test('allows checked creates that connect the authenticated user', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const args = {
            data: {
                user: { connect: { id: 'user-1' } },
                server: { connect: { id: 'server-1' } },
            },
        };

        await expect(extension.userMcpServer.create({
            args,
            query: resetQuery(),
        })).resolves.toBe(args);
    });

    test('rejects checked creates that do not connect the authenticated user', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(extension.userMcpServer.create({
            args: {
                data: {
                    user: { connect: { id: 'user-2' } },
                    server: { connect: { id: 'server-1' } },
                },
            },
            query,
        })).rejects.toThrow('must create UserMcpServer rows for the authenticated user');
        await expect(extension.userMcpServer.create({
            args: {
                data: {
                    user: { create: { id: 'user-1', email: 'test@example.com' } },
                    server: { connect: { id: 'server-1' } },
                },
            },
            query,
        })).rejects.toThrow('must create UserMcpServer rows for the authenticated user');

        expect(query).not.toHaveBeenCalled();
    });

    test('rejects mismatched update/delete composite keys', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(extension.userMcpServer.update({
            args: {
                where: { userId_serverId: { userId: 'user-2', serverId: 'server-1' } },
                data: { state: null },
            },
            query,
        })).rejects.toThrow('cannot access UserMcpServer rows for another user');
        await expect(extension.userMcpServer.delete({
            args: { where: { userId_serverId: { userId: 'user-2', serverId: 'server-1' } } },
            query,
        })).rejects.toThrow('cannot access UserMcpServer rows for another user');

        expect(query).not.toHaveBeenCalled();
    });

    test('rejects attempts to mutate UserMcpServer ownership', async () => {
        const extension = getMcpPrismaQueryExtension(user);

        await expect(extension.userMcpServer.update({
            args: {
                where: { userId_serverId: { userId: 'user-1', serverId: 'server-1' } },
                data: { userId: 'user-2' },
            },
            query: resetQuery(),
        })).rejects.toThrow('cannot change UserMcpServer identity');
        await expect(extension.userMcpServer.update({
            args: {
                where: { userId_serverId: { userId: 'user-1', serverId: 'server-1' } },
                data: { server: { connect: { id: 'server-2' } } },
            },
            query: resetQuery(),
        })).rejects.toThrow('cannot change UserMcpServer identity');
        await expect(extension.userMcpServer.upsert({
            args: {
                where: { userId_serverId: { userId: 'user-1', serverId: 'server-1' } },
                create: { userId: 'user-1', serverId: 'server-1' },
                update: { user: { connect: { id: 'user-2' } } },
            },
            query: resetQuery(),
        })).rejects.toThrow('cannot change UserMcpServer identity');
    });

    test('scopes updateMany and deleteMany', async () => {
        const extension = getMcpPrismaQueryExtension(user);

        await expect(extension.userMcpServer.updateMany({
            args: { where: { tokens: { not: null } }, data: { state: null } },
            query: resetQuery(),
        })).resolves.toEqual({
            where: {
                AND: [
                    { tokens: { not: null } },
                    { userId: 'user-1' },
                ],
            },
            data: { state: null },
        });
        await expect(extension.userMcpServer.deleteMany({
            args: { where: { serverId: 'server-1' } },
            query: resetQuery(),
        })).resolves.toEqual({
            where: {
                AND: [
                    { serverId: 'server-1' },
                    { userId: 'user-1' },
                ],
            },
        });
    });

    test('scopes returning bulk UserMcpServer operations', async () => {
        const extension = getMcpPrismaQueryExtension(user);

        await expect(extension.userMcpServer.createManyAndReturn({
            args: { data: { userId: 'user-2', serverId: 'server-1' } },
            query: resetQuery(),
        })).rejects.toThrow('must create UserMcpServer rows for the authenticated user');
        await expect(extension.userMcpServer.updateManyAndReturn({
            args: { where: { serverId: 'server-1' }, data: { state: null } },
            query: resetQuery(),
        })).resolves.toEqual({
            where: {
                AND: [
                    { serverId: 'server-1' },
                    { userId: 'user-1' },
                ],
            },
            data: { state: null },
        });
    });

    test('rejects nested UserMcpServer relation access through direct UserMcpServer queries', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(extension.userMcpServer.findMany({
            args: {
                include: {
                    server: {
                        include: {
                            userMcpServers: true,
                        },
                    },
                },
            },
            query,
        })).rejects.toThrow('cannot access UserMcpServer rows through a parent relation');

        expect(query).not.toHaveBeenCalled();
    });

    test('rejects nested UserMcpServer writes through McpServer operations', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(callAllOperations(
            extension.mcpServer,
            'update',
            {
                where: { id: 'server-1' },
                data: { userMcpServers: { create: { userId: 'user-1' } } },
            },
            query,
        )).rejects.toThrow('cannot access UserMcpServer rows through a parent relation');

        expect(query).not.toHaveBeenCalled();
    });

    test('rejects nested UserMcpServer reads and writes through parent models', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(callAllOperations(
            extension.mcpServer,
            'findUnique',
            {
                where: { id: 'server-1' },
                include: { userMcpServers: true },
            },
            query,
        )).rejects.toThrow('cannot access UserMcpServer rows through a parent relation');
        await expect(callAllOperations(
            extension.user,
            'findMany',
            {
                where: { userMcpServers: { some: { serverId: 'server-1' } } },
            },
            query,
        )).rejects.toThrow('cannot access UserMcpServer rows through a parent relation');
        await expect(callAllOperations(
            extension.user,
            'update',
            {
                where: { id: 'user-1' },
                data: { userMcpServers: { create: { serverId: 'server-1' } } },
            },
            query,
        )).rejects.toThrow('cannot access UserMcpServer rows through a parent relation');

        expect(query).not.toHaveBeenCalled();
    });

    test('rejects transitive MCP relation access through Org and UserToOrg operations', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(callAllOperations(
            extension.org,
            'findUnique',
            {
                where: { id: 1 },
                include: {
                    mcpServers: {
                        include: {
                            userMcpServers: true,
                        },
                    },
                },
            },
            query,
        )).rejects.toThrow('cannot access MCP server relations through a parent relation');
        await expect(callAllOperations(
            extension.org,
            'update',
            {
                where: { id: 1 },
                data: {
                    mcpServers: {
                        create: {
                            name: 'Linear',
                            sanitizedName: 'linear',
                            serverUrl: 'https://mcp.linear.app/mcp',
                            userMcpServers: {
                                create: { userId: 'user-1' },
                            },
                        },
                    },
                },
            },
            query,
        )).rejects.toThrow('cannot access MCP server relations through a parent relation');
        await expect(callAllOperations(
            extension.userToOrg,
            'findMany',
            {
                include: {
                    org: {
                        include: {
                            mcpServers: {
                                include: {
                                    userMcpServers: true,
                                },
                            },
                        },
                    },
                },
            },
            query,
        )).rejects.toThrow('cannot access MCP server relations through a parent relation');

        expect(query).not.toHaveBeenCalled();
    });

    test('allows JSON metadata payloads with relation-like keys', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const args = {
            where: { id: 1 },
            data: {
                metadata: {
                    mcpServers: 'display-state',
                    userMcpServers: { collapsed: true },
                },
            },
        };

        await expect(callAllOperations(extension.org, 'update', args)).resolves.toBe(args);
    });

    test('passes safe parent-model operations through the compact hooks', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const args = { where: { orgId: 1 } };

        await expect(callAllOperations(extension.userToOrg, 'findMany', args)).resolves.toBe(args);
    });

    test('allows single user deletes but blocks bulk user deletes', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const args = { where: { id: 'user-2' } };
        const query = resetQuery();

        await expect(callAllOperations(extension.user, 'delete', args, query)).resolves.toBe(args);
        expect(query).toHaveBeenCalledTimes(1);
        query.mockClear();

        await expect(callAllOperations(extension.user, 'deleteMany', { where: {} }, query))
            .rejects.toThrow('user.deleteMany cannot delete users through a user-scoped client');
        expect(query).not.toHaveBeenCalled();
    });

    test('rejects shared McpServer deletes through the scoped client', async () => {
        const extension = getMcpPrismaQueryExtension(user);
        const query = resetQuery();

        await expect(callAllOperations(
            extension.mcpServer,
            'delete',
            { where: { id: 'server-1' } },
            query,
        )).rejects.toThrow('cannot delete shared McpServer rows through a user-scoped client');
        await expect(callAllOperations(
            extension.mcpServer,
            'deleteMany',
            { where: { orgId: 1 } },
            query,
        )).rejects.toThrow('cannot delete shared McpServer rows through a user-scoped client');

        expect(query).not.toHaveBeenCalled();
    });
});
