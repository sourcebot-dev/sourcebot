"use client"

import { AnalyticsContent } from "@/ee/features/analytics/analyticsContent";
import { AnalyticsEntitlementMessage } from "@/ee/features/analytics/analyticsEntitlementMessage";
import { useHasEntitlement } from "@/features/entitlements/useHasEntitlement";

export default function AnalyticsPage() {
  return <AnalyticsPageContent />;
}

function AnalyticsPageContent() {
  const hasAnalyticsEntitlement = useHasEntitlement("analytics");

  if (!hasAnalyticsEntitlement) {
    return <AnalyticsEntitlementMessage />;
  }

  return <AnalyticsContent />;
} 