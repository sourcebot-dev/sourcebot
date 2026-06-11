'use server';

import { getProviders } from "@/auth";
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { isAnonymousAccessAvailable } from "@/lib/entitlements";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";

export const setMemberApprovalRequired = async (required: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (env.REQUIRE_APPROVAL_NEW_MEMBERS !== undefined) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.MEMBER_APPROVAL_CONTROLLED_BY_ENV,
                    message: "Member approval is controlled by the REQUIRE_APPROVAL_NEW_MEMBERS environment variable and cannot be changed from the UI.",
                } satisfies ServiceError;
            }

            await prisma.org.update({
                where: { id: org.id },
                data: { memberApprovalRequired: required },
            });

            return {
                success: true,
            };
        })
    )
);

export const setCredentialsLoginEnabled = async (enabled: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (env.AUTH_CREDENTIALS_LOGIN_ENABLED !== undefined) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.EMAIL_LOGIN_CONTROLLED_BY_ENV,
                    message: "Email login is controlled by the AUTH_CREDENTIALS_LOGIN_ENABLED environment variable and cannot be changed from the UI.",
                } satisfies ServiceError;
            }

            const providers = await getProviders();
            const hasAlternativeLoginMethod = providers.some((provider) => provider.type !== "credentials");

            // Don't allow disabling email login when it would leave no other way to
            // sign in (i.e. no SSO identity providers and no magic-code email login).
            if (!enabled && !hasAlternativeLoginMethod) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.EMAIL_LOGIN_CANNOT_BE_DISABLED,
                    message: "Email login cannot be disabled because no other login method is configured.",
                } satisfies ServiceError;
            }

            await prisma.org.update({
                where: { id: org.id },
                data: { isCredentialsLoginEnabled: enabled },
            });

            return {
                success: true,
            };
        })
    )
);

export const setAnonymousAccessStatus = async (enabled: boolean): Promise<ServiceError | boolean> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (env.FORCE_ENABLE_ANONYMOUS_ACCESS !== undefined) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.ANONYMOUS_ACCESS_CONTROLLED_BY_ENV,
                    message: "Anonymous access is controlled by the FORCE_ENABLE_ANONYMOUS_ACCESS environment variable and cannot be changed from the UI.",
                } satisfies ServiceError;
            }

            const anonymousAccessAvailable = await isAnonymousAccessAvailable();
            if (!anonymousAccessAvailable) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: `Anonymous access is not supported in your current plan. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`,
                } satisfies ServiceError;
            }

            await prisma.org.update({
                where: {
                    id: org.id,
                },
                data: {
                    isAnonymousAccessEnabled: enabled,
                },
            });

            return true;
        })
    )
);


export const setInviteLinkEnabled = async (enabled: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            await prisma.org.update({
                where: { id: org.id },
                data: { inviteLinkEnabled: enabled },
            });

            return {
                success: true,
            };
        })
    )
);
