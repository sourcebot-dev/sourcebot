import { getMe } from "@/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { notFound } from "next/navigation";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { getOrgFromDomain } from "@/data/org";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { env } from "@sourcebot/shared";

export default async function ApiKeysLayout({ children, params }: { children: React.ReactNode, params: Promise<{ domain: string }> }) {
    const { domain } = await params;

    const org = await getOrgFromDomain(domain);
    if (!org) {
        throw new ServiceErrorException({
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.ORG_NOT_FOUND,
            message: "Organization not found",
        });
    }

    const me = await getMe();
    if (isServiceError(me)) {
        throw new ServiceErrorException(me);
    }

    const userRoleInOrg = me.memberships.find((membership) => membership.id === org.id)?.role;
    if (!userRoleInOrg) {
        throw new ServiceErrorException({
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.UNEXPECTED_ERROR,
            message: "User role not found",
        });
    }

    if (env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true' && userRoleInOrg !== OrgRole.OWNER) {
        return notFound();
    }

    return children;
}