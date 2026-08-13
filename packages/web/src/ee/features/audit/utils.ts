import { UserType, UserWithAccounts } from "@sourcebot/db";
import { AuditActor } from "./types";

/**
 * Builds the audit actor for an action performed by a resolved `withAuth`
 * user. Resolves to `"service_account"` when the acting identity is a
 * service account (e.g. its own API key was used to call an audited action)
 * and `"user"` otherwise.
 */
export const auditActorForUser = (user: UserWithAccounts): AuditActor => ({
    id: user.id,
    type: user.type === UserType.SERVICE ? "service_account" : "user",
});
