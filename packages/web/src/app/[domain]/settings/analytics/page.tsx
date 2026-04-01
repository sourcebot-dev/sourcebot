import { getMe } from "@/actions";
import { getOrgFromDomain } from "@/data/org";
import { AnalyticsContent } from "@/ee/features/analytics/analyticsContent";
import { AnalyticsEntitlementMessage } from "@/ee/features/analytics/analyticsEntitlementMessage";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { OrgRole } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{
      domain: string;
  }>
}

export default async function AnalyticsPage(props: Props) {
  const params = await props.params;

    const {
        domain
    } = params;

    const org = await getOrgFromDomain(domain);
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
        redirect(`/${domain}/settings`);
    }

  const hasAnalyticsEntitlement = hasEntitlement("analytics");

  if (!hasAnalyticsEntitlement) {
    return <AnalyticsEntitlementMessage />;
  }

  return <AnalyticsContent />;
}
