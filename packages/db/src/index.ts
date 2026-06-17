import type { User, Account } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";

export const personalAgentSkillScope = (userId: string) => ({
    visibility: "PERSONAL" as const,
    scopeId: userId,
});
