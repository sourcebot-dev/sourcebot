import { Prisma, UserWithAccounts } from '@sourcebot/db';

type QueryHookParams<TArgs> = {
    args: TArgs;
    query: (args: TArgs) => Promise<unknown>;
};

type AllOperationsHookParams = {
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
};

type UserMcpServerWhereArgs = {
    where?: Prisma.UserMcpServerWhereInput;
};

type UserMcpServerWhereUniqueArgs = {
    where: Prisma.UserMcpServerWhereUniqueInput;
};

type UserMcpServerCreateArgs = {
    data: unknown;
};

type UserMcpServerUpdateArgs = UserMcpServerWhereUniqueArgs & {
    data: unknown;
};

type UserMcpServerUpsertArgs = UserMcpServerWhereUniqueArgs & {
    create: unknown;
    update: unknown;
};

// Deliberately impossible filter — AND-ing two different userId values guarantees zero rows.
// Used as the fallback when no user is authenticated, so anonymous queries see nothing.
// Prisma doesn't expose a "match nothing" primitive, so this is the standard workaround.
const anonymousUserScope: Prisma.UserMcpServerWhereInput = {
    AND: [
        { userId: '__sourcebot_anonymous_user__' },
        { userId: '__sourcebot_no_authenticated_user__' },
    ],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const userScopeWhere = (user?: UserWithAccounts): Prisma.UserMcpServerWhereInput =>
    user ? { userId: user.id } : anonymousUserScope;

export const scopeUserMcpServerWhere = (
    where: Prisma.UserMcpServerWhereInput | undefined,
    user?: UserWithAccounts,
): Prisma.UserMcpServerWhereInput => {
    const scope = userScopeWhere(user);
    return where ? { AND: [where, scope] } : scope;
};

const scopeUserMcpServerReadArgs = <TArgs extends UserMcpServerWhereArgs>(
    args: TArgs,
    user?: UserWithAccounts,
): TArgs => ({
    ...args,
    where: scopeUserMcpServerWhere(args.where, user),
});

const requireAuthenticatedUser = (
    user: UserWithAccounts | undefined,
    operation: string,
): UserWithAccounts => {
    if (!user) {
        throw new Error(`${operation} requires an authenticated user.`);
    }
    return user;
};

const uniqueWhereUserId = (where: Prisma.UserMcpServerWhereUniqueInput): string | undefined => {
    const compositeKey = where.userId_serverId;
    return isRecord(compositeKey) && typeof compositeKey.userId === 'string'
        ? compositeKey.userId
        : undefined;
};

export const isUserMcpServerUniqueWhereForUser = (
    where: Prisma.UserMcpServerWhereUniqueInput,
    user?: UserWithAccounts,
) => !!user && uniqueWhereUserId(where) === user.id;

const assertUserMcpServerUniqueWhereForUser = (
    where: Prisma.UserMcpServerWhereUniqueInput,
    user: UserWithAccounts | undefined,
    operation: string,
) => {
    const authenticatedUser = requireAuthenticatedUser(user, operation);
    if (!isUserMcpServerUniqueWhereForUser(where, authenticatedUser)) {
        throw new Error(`${operation} cannot access UserMcpServer rows for another user.`);
    }
};

const assertNoIdentityMutation = (data: unknown, operation: string) => {
    if (!isRecord(data)) {
        return;
    }

    if ('userId' in data || 'user' in data || 'serverId' in data || 'server' in data) {
        throw new Error(`${operation} cannot change UserMcpServer identity.`);
    }
};

// Extracts the userId from a Prisma relation connect object.
// Prisma's connect syntax for a relation looks like: { connect: { id: "some-id" } }
const connectedUserId = (userRelation: unknown): string | undefined => {
    if (!isRecord(userRelation) || !('connect' in userRelation)) {
        return undefined;
    }

    const connect = userRelation.connect;
    if (!isRecord(connect) || !('id' in connect) || typeof connect.id !== 'string') {
        return undefined;
    }

    return connect.id;
};

const createDataUserId = (row: unknown): string | undefined => {
    if (!isRecord(row)) {
        return undefined;
    }
    const scalarUserId = typeof row.userId === 'string' ? row.userId : undefined;
    const relationUserId = row.user === undefined ? undefined : connectedUserId(row.user);

    if (row.user !== undefined && relationUserId === undefined) {
        return undefined;
    }
    if (scalarUserId !== undefined && relationUserId !== undefined && scalarUserId !== relationUserId) {
        return undefined;
    }

    return relationUserId ?? scalarUserId;
};

const assertCreateDataForUser = (
    data: unknown,
    user: UserWithAccounts | undefined,
    operation: string,
) => {
    const authenticatedUser = requireAuthenticatedUser(user, operation);

    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
        if (createDataUserId(row) !== authenticatedUser.id) {
            throw new Error(`${operation} must create UserMcpServer rows for the authenticated user.`);
        }
    }
};

const scopeUserMcpServerWriteManyArgs = <TArgs extends UserMcpServerWhereArgs>(
    args: TArgs,
    user: UserWithAccounts | undefined,
    operation: string,
): TArgs => {
    const authenticatedUser = requireAuthenticatedUser(user, operation);
    return scopeUserMcpServerReadArgs(args, authenticatedUser);
};

const PRISMA_SELECTION_KEYS = new Set(['include', 'select']);
const PRISMA_STRUCTURAL_KEYS = new Set([
    ...PRISMA_SELECTION_KEYS,
    'where',
    'orderBy',
    'data',
    'create',
    'connectOrCreate',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'AND',
    'OR',
    'NOT',
    'some',
    'none',
    'every',
    'is',
    'isNot',
]);
const MCP_RELATION_BRIDGE_KEYS = new Set([
    'user',
    'server',
    'org',
    'orgs',
    'members',
]);

const containsPrismaRelationAccess = (
    value: unknown,
    relationNames: string[],
    isSelectionObject = false,
): boolean => {
    if (Array.isArray(value)) {
        return value.some((item) => containsPrismaRelationAccess(item, relationNames, isSelectionObject));
    }
    if (!isRecord(value)) {
        return false;
    }
    if (relationNames.some((relationName) => relationName in value)) {
        return true;
    }

    return Object.entries(value).some(([key, nestedValue]) => {
        if (PRISMA_SELECTION_KEYS.has(key)) {
            return containsPrismaRelationAccess(nestedValue, relationNames, true);
        }

        if (isSelectionObject || PRISMA_STRUCTURAL_KEYS.has(key) || MCP_RELATION_BRIDGE_KEYS.has(key)) {
            return containsPrismaRelationAccess(nestedValue, relationNames);
        }

        return false;
    });
};

const assertNoUserMcpServerRelationAccess = (args: unknown, operation: string) => {
    if (containsPrismaRelationAccess(args, ['userMcpServers'])) {
        throw new Error(`${operation} cannot access UserMcpServer rows through a parent relation.`);
    }
};

const assertNoMcpServerRelationAccess = (args: unknown, operation: string) => {
    if (containsPrismaRelationAccess(args, ['mcpServers', 'userMcpServers'])) {
        throw new Error(`${operation} cannot access MCP server relations through a parent relation.`);
    }
};

const rejectSharedMcpServerDelete = (operation: string) => {
    throw new Error(`${operation} cannot delete shared McpServer rows through a user-scoped client.`);
};

const rejectUserDeleteMany = () => {
    throw new Error('user.deleteMany cannot delete users through a user-scoped client.');
};

const guardMcpParentOperation = (
    modelName: string,
    guard: (args: unknown, operation: string) => void,
) => async ({ operation, args, query }: AllOperationsHookParams) => {
    guard(args, `${modelName}.${operation}`);
    return query(args);
};

export const getMcpPrismaQueryExtension = (user?: UserWithAccounts) => ({
    userMcpServer: {
        async findMany({ args, query }: QueryHookParams<Prisma.UserMcpServerFindManyArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.findMany');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async findFirst({ args, query }: QueryHookParams<Prisma.UserMcpServerFindFirstArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.findFirst');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async findFirstOrThrow({ args, query }: QueryHookParams<Prisma.UserMcpServerFindFirstOrThrowArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.findFirstOrThrow');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async findUnique({ args, query }: QueryHookParams<Prisma.UserMcpServerFindUniqueArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.findUnique');
            // Preserve Prisma's nullable "not found" semantics for scoped reads. Callers that
            // need a hard failure should use findUniqueOrThrow; write paths throw on mismatch.
            return isUserMcpServerUniqueWhereForUser(args.where, user) ? query(args) : null;
        },
        async findUniqueOrThrow({ args, query }: QueryHookParams<Prisma.UserMcpServerFindUniqueOrThrowArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.findUniqueOrThrow');
            assertUserMcpServerUniqueWhereForUser(args.where, user, 'userMcpServer.findUniqueOrThrow');
            return query(args);
        },
        async count({ args, query }: QueryHookParams<Prisma.UserMcpServerCountArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.count');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async aggregate({ args, query }: QueryHookParams<Prisma.UserMcpServerAggregateArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.aggregate');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async groupBy({ args, query }: QueryHookParams<Prisma.UserMcpServerGroupByArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.groupBy');
            return query(scopeUserMcpServerReadArgs(args, user));
        },
        async create({ args, query }: QueryHookParams<Prisma.UserMcpServerCreateArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.create');
            assertCreateDataForUser((args as UserMcpServerCreateArgs).data, user, 'userMcpServer.create');
            return query(args);
        },
        async createMany({ args, query }: QueryHookParams<Prisma.UserMcpServerCreateManyArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.createMany');
            assertCreateDataForUser((args as UserMcpServerCreateArgs).data, user, 'userMcpServer.createMany');
            return query(args);
        },
        async createManyAndReturn({ args, query }: QueryHookParams<Prisma.UserMcpServerCreateManyAndReturnArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.createManyAndReturn');
            assertCreateDataForUser((args as UserMcpServerCreateArgs).data, user, 'userMcpServer.createManyAndReturn');
            return query(args);
        },
        async update({ args, query }: QueryHookParams<Prisma.UserMcpServerUpdateArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.update');
            assertUserMcpServerUniqueWhereForUser(args.where, user, 'userMcpServer.update');
            assertNoIdentityMutation((args as UserMcpServerUpdateArgs).data, 'userMcpServer.update');
            return query(args);
        },
        async updateMany({ args, query }: QueryHookParams<Prisma.UserMcpServerUpdateManyArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.updateMany');
            requireAuthenticatedUser(user, 'userMcpServer.updateMany');
            assertNoIdentityMutation((args as UserMcpServerUpdateArgs).data, 'userMcpServer.updateMany');
            return query(scopeUserMcpServerWriteManyArgs(args, user, 'userMcpServer.updateMany'));
        },
        async updateManyAndReturn({ args, query }: QueryHookParams<Prisma.UserMcpServerUpdateManyAndReturnArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.updateManyAndReturn');
            requireAuthenticatedUser(user, 'userMcpServer.updateManyAndReturn');
            assertNoIdentityMutation((args as UserMcpServerUpdateArgs).data, 'userMcpServer.updateManyAndReturn');
            return query(scopeUserMcpServerWriteManyArgs(args, user, 'userMcpServer.updateManyAndReturn'));
        },
        async delete({ args, query }: QueryHookParams<Prisma.UserMcpServerDeleteArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.delete');
            assertUserMcpServerUniqueWhereForUser(args.where, user, 'userMcpServer.delete');
            return query(args);
        },
        async deleteMany({ args, query }: QueryHookParams<Prisma.UserMcpServerDeleteManyArgs>) {
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.deleteMany');
            return query(scopeUserMcpServerWriteManyArgs(args, user, 'userMcpServer.deleteMany'));
        },
        async upsert({ args, query }: QueryHookParams<Prisma.UserMcpServerUpsertArgs>) {
            const upsertArgs = args as UserMcpServerUpsertArgs;
            assertNoUserMcpServerRelationAccess(args, 'userMcpServer.upsert');
            assertUserMcpServerUniqueWhereForUser(args.where, user, 'userMcpServer.upsert');
            assertCreateDataForUser(upsertArgs.create, user, 'userMcpServer.upsert');
            assertNoIdentityMutation(upsertArgs.update, 'userMcpServer.upsert');
            return query(args);
        },
    },
    user: {
        async $allOperations({ operation, args, query }: AllOperationsHookParams) {
            if (operation === 'deleteMany') {
                rejectUserDeleteMany();
            }
            // The owner-only user deletion API intentionally deletes one user and relies on
            // cascade to remove that user's rows. Bulk deletes stay blocked above.
            assertNoUserMcpServerRelationAccess(args, `user.${operation}`);
            return query(args);
        },
    },
    mcpServer: {
        async $allOperations({ operation, args, query }: AllOperationsHookParams) {
            if (operation === 'delete' || operation === 'deleteMany') {
                rejectSharedMcpServerDelete(`mcpServer.${operation}`);
            }
            assertNoUserMcpServerRelationAccess(args, `mcpServer.${operation}`);
            return query(args);
        },
    },
    org: {
        $allOperations: guardMcpParentOperation('org', assertNoMcpServerRelationAccess),
    },
    userToOrg: {
        $allOperations: guardMcpParentOperation('userToOrg', assertNoMcpServerRelationAccess),
    },
});
