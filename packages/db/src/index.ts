import type { User, Account } from ".prisma/client";
export type UserWithAccounts = User & { accounts: Account[] };
export * from ".prisma/client";

export type AgentSkillScope = "PERSONAL" | "ORG";

type AgentSkillNamespaceInput =
    | { scope: "PERSONAL"; userId: string }
    | { scope: "ORG"; orgId: number };

// The namespaceKey is the single source of truth for a skill's scope and owner.
// The "user:" / "org:" prefix is disjoint, so the scope is fully derivable from it
// and (namespaceKey, slug) is a robust, collision-proof unique key on its own.
export const getAgentSkillNamespaceKey = (input: AgentSkillNamespaceInput) => {
    if (input.scope === "PERSONAL") {
        return `user:${input.userId}`;
    }

    return `org:${input.orgId}`;
};

export const getAgentSkillScopeFromNamespaceKey = (namespaceKey: string): AgentSkillScope =>
    namespaceKey.startsWith("org:") ? "ORG" : "PERSONAL";
