import { getMe } from "@/actions";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { prisma } from "@/prisma";
import { AnalyticsContent } from "@/ee/features/analytics/analyticsContent";
import { AnalyticsEntitlementMessage } from "@/ee/features/analytics/analyticsEntitlementMessage";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
    const org = await prisma.org.findUnique({ where: { id: SINGLE_TENANT_ORG_ID } });
    if (!org) {
        throw new Error("Organization not found");
    }

    const me = await getMe();
    if (isServiceError(me)) {
        throw new ServiceErrorException(me);
    }

    const userRoleInOrg = me.memberships.find((membership) => membership.id === org.id)?.role;
    if (!userRoleInOrg) {
        throw new Error("User role not found");
    }

    if (userRoleInOrg !== OrgRole.OWNER) {
        redirect('/settings');
    }

  const hasAnalyticsEntitlement = hasEntitlement("analytics");

  if (!hasAnalyticsEntitlement) {
    return <AnalyticsEntitlementMessage />;
  }

  return <AnalyticsContent />;
}
