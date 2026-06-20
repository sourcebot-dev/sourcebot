import type { User as AuthJsUser } from "next-auth";
import { __unsafePrisma } from "@/prisma";
import { OrgRole } from "@sourcebot/db";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { isMemberApprovalRequired } from "@sourcebot/shared";
import { createAudit } from "@/ee/features/audit/audit";
import { isScimEnabled } from "@/features/scim/utils";
import { getDefaultMemberRole } from "@/features/membership/utils";
import { isServiceError } from "@/lib/utils";
import { addMember } from "@/features/membership/membership.service";
import { logger } from "./logger";
import { captureEvent } from "@/lib/posthog";

/**
 * Auth-layer hook invoked whenever a new user account is created (NextAuth's
 * `createUser` event, the credentials provider, and SSO). Handles org onboarding:
 * the first user bootstraps the org as OWNER, subsequent users auto-join as
 * members in open self-serve mode, and auto-join is suppressed when member
 * approval is required or SCIM is enabled (the IdP is then the source of truth).
 * Membership writes go through the membership service.
 */
export const onCreateUser = async ({ user }: { user: AuthJsUser }) => {
    if (!user.id) {
        logger.error("User ID is undefined on user creation");
        await createAudit({
            action: "user.creation_failed",
            actor: {
                id: "undefined",
                type: "user"
            },
            target: {
                id: "undefined",
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            metadata: {
                message: "User ID is undefined on user creation"
            }
        });
        throw new Error("User ID is undefined on user creation");
    }

    const defaultOrg = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        include: {
            members: true,
        }
    });

    if (defaultOrg === null) {
        await createAudit({
            action: "user.creation_failed",
            actor: {
                id: user.id,
                type: "user"
            },
            target: {
                id: user.id,
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            metadata: {
                message: "Default org not found on single tenant user creation"
            }
        });
        throw new Error("Default org not found on single tenant user creation");
    }

    // @note when creating a user, there are two cases for when
    // we should be adding them to the single tenant organization.
    //
    // 1. The organization is empty. In this case, we add the
    // user as a member with the OWNER role.
    const isFirstUser = defaultOrg.members.length === 0;
    if (isFirstUser) {
        const result = await addMember(SINGLE_TENANT_ORG_ID, user.id, {
            actor: { id: user.id, type: "user" },
            role: OrgRole.OWNER,
        });
        if (isServiceError(result)) {
            throw new Error(`Failed to bootstrap initial owner for user ${user.id}: ${result.message}`);
        }

        await createAudit({
            action: "user.owner_created",
            actor: {
                id: user.id,
                type: "user"
            },
            orgId: SINGLE_TENANT_ORG_ID,
            target: {
                id: SINGLE_TENANT_ORG_ID.toString(),
                type: "org"
            }
        });
    }

    // 2. Otherwise, if both member approvals is disabled &&
    // scim is disabled, then we add the user as a member with
    // whatever the default role is.
    else if (
        !isMemberApprovalRequired(defaultOrg) &&
        !(await isScimEnabled(defaultOrg))
    ) {
        const result = await addMember(SINGLE_TENANT_ORG_ID, user.id, {
            actor: { id: user.id, type: "user" },
            role: await getDefaultMemberRole(),
        });
        if (isServiceError(result)) {
            logger.warn(`onCreateUser: user ${user.id} was not auto-joined to org ${SINGLE_TENANT_ORG_ID}: ${result.message}`);
            return;
        }
    }

    // Dynamic import to avoid circular dependency:
    // authUtils -> posthog -> auth -> authUtils
    await captureEvent('wa_user_created', { userId: user.id });
};