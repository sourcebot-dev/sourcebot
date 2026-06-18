import type { Account, Prisma, User } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";

export const personalAgentSkillScope = (userId: string) => ({
    visibility: "PERSONAL" as const,
    scopeId: userId,
});

export const orgAgentSkillScope = (orgId: number) => ({
    visibility: "ORG" as const,
    scopeId: String(orgId),
});

export const personalAgentSkillAuthScope = (userId: string) => ({
    ...personalAgentSkillScope(userId),
    createdById: userId,
    orgId: null,
});

export const orgAgentSkillAuthScope = (orgId: number) => ({
    ...orgAgentSkillScope(orgId),
    orgId,
});

export const orgAgentSkillVisibleToUserWhere = (userId: string, orgId: number) => ({
    ...orgAgentSkillAuthScope(orgId),
    enabled: true,
    AND: [
        {
            OR: [
                { autoEnrolled: true },
                {
                    adoptions: {
                        some: {
                            userId,
                            orgId,
                            removedAt: null,
                        },
                    },
                },
            ],
        },
        {
            NOT: {
                adoptions: {
                    some: {
                        userId,
                        orgId,
                        removedAt: {
                            not: null,
                        },
                    },
                },
            },
        },
    ],
}) satisfies Prisma.AgentSkillWhereInput;
