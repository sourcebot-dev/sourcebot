import type { Account, Prisma, User } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";

// Personal skills are scoped to the (user, org) pair: a user's personal skills
// change when they switch orgs. scopeId is the userId; orgId binds it to the org.
export const personalAgentSkillScope = (userId: string, orgId: number) => ({
    visibility: "PERSONAL" as const,
    scopeId: userId,
    orgId,
});

// Shared skills are visible to the whole org. scopeId is String(orgId) so every
// shared skill in an org occupies one slug-uniqueness namespace.
export const sharedAgentSkillScope = (orgId: number) => ({
    visibility: "SHARED" as const,
    scopeId: String(orgId),
    orgId,
});

export const personalAgentSkillAuthScope = (userId: string, orgId: number) => ({
    ...personalAgentSkillScope(userId, orgId),
    createdById: userId,
});

export const sharedAgentSkillAuthScope = (orgId: number) => ({
    ...sharedAgentSkillScope(orgId),
});

export const sharedAgentSkillVisibleToUserWhere = (userId: string, orgId: number) => ({
    ...sharedAgentSkillAuthScope(orgId),
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
