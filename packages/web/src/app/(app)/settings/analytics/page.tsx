import { AnalyticsContent } from "@/ee/features/analytics/analyticsContent";
import { AnalyticsEntitlementMessage } from "@/ee/features/analytics/analyticsEntitlementMessage";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { OrgRole } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";

export default authenticatedPage(async () => {
    const hasAnalyticsEntitlement = hasEntitlement("analytics");

    if (!hasAnalyticsEntitlement) {
        return <AnalyticsEntitlementMessage />;
    }

    return <AnalyticsContent />;
}, { minRole: OrgRole.OWNER, redirectTo: '/settings' });
