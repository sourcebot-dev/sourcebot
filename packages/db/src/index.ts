import type { User, Account } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";

type AgentSkillNamespaceInput =
    | { scope: "PERSONAL"; userId: string }
    | { scope: "ORG"; orgId: number };

export const getAgentSkillNamespaceKey = (input: AgentSkillNamespaceInput) => {
    if (input.scope === "PERSONAL") {
        return `user:${input.userId}`;
    }

    return `org:${input.orgId}`;
};
