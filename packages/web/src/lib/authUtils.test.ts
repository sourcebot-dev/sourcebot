import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({ default: vi.fn() }));
vi.mock("@/prisma", async () => {
    const actual = await vi.importActual<typeof import("@/__mocks__/prisma")>("@/__mocks__/prisma");
    return { ...actual };
});

import { computeOAuthLinkConflictAudit } from "./authUtils";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";

describe("computeOAuthLinkConflictAudit", () => {
    const oauthAccount = {
        provider: "github",
        providerAccountId: "upstream-123",
        type: "oauth" as const,
    };

    test("returns audit event when upstream identity is linked to a different user than the one currently signed in", () => {
        const result = computeOAuthLinkConflictAudit({
            account: oauthAccount,
            existingLinkedUserId: "user-victim",
            currentUserId: "user-attacker",
        });

        expect(result).toEqual({
            action: "account.link_failed_already_linked",
            actor: { id: "user-attacker", type: "user" },
            target: { id: "user-victim", type: "user" },
            orgId: SINGLE_TENANT_ORG_ID,
            metadata: {
                provider: "github",
                providerAccountId: "upstream-123",
            },
        });
    });

    test("returns audit event for OIDC providers too", () => {
        const result = computeOAuthLinkConflictAudit({
            account: { ...oauthAccount, type: "oidc" },
            existingLinkedUserId: "user-victim",
            currentUserId: "user-attacker",
        });

        expect(result).not.toBeNull();
        expect(result?.action).toBe("account.link_failed_already_linked");
    });

    test("returns null when the upstream identity is linked to the same user that is signed in (re-authentication)", () => {
        const result = computeOAuthLinkConflictAudit({
            account: oauthAccount,
            existingLinkedUserId: "user-same",
            currentUserId: "user-same",
        });

        expect(result).toBeNull();
    });

    test("returns null when there is no signed-in user (fresh OAuth login that NextAuth will resolve to the existing user)", () => {
        const result = computeOAuthLinkConflictAudit({
            account: oauthAccount,
            existingLinkedUserId: "user-victim",
            currentUserId: undefined,
        });

        expect(result).toBeNull();
    });

    test("returns null when the upstream identity is not yet linked to any user", () => {
        const result = computeOAuthLinkConflictAudit({
            account: oauthAccount,
            existingLinkedUserId: null,
            currentUserId: "user-attacker",
        });

        expect(result).toBeNull();
    });

    test("returns null for non-OAuth providers (credentials, email, webauthn)", () => {
        for (const type of ["credentials", "email", "webauthn"] as const) {
            const result = computeOAuthLinkConflictAudit({
                account: { ...oauthAccount, type },
                existingLinkedUserId: "user-victim",
                currentUserId: "user-attacker",
            });
            expect(result, `type=${type}`).toBeNull();
        }
    });

    test("returns null when account is missing required fields", () => {
        expect(
            computeOAuthLinkConflictAudit({
                account: null,
                existingLinkedUserId: "user-victim",
                currentUserId: "user-attacker",
            })
        ).toBeNull();

        expect(
            computeOAuthLinkConflictAudit({
                account: { provider: "", providerAccountId: "id", type: "oauth" },
                existingLinkedUserId: "user-victim",
                currentUserId: "user-attacker",
            })
        ).toBeNull();

        expect(
            computeOAuthLinkConflictAudit({
                account: { provider: "github", providerAccountId: "", type: "oauth" },
                existingLinkedUserId: "user-victim",
                currentUserId: "user-attacker",
            })
        ).toBeNull();
    });
});
