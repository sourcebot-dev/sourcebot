import { NavigationMenu } from "../components/navigationMenu";
import { Header } from "../components/header";
import { AnalyticsContent } from "@/ee/features/analytics/analyticsContent";
import { AnalyticsEntitlementMessage } from "@/ee/features/analytics/analyticsEntitlementMessage";
import { hasEntitlement } from '@sourcebot/shared';

export default async function AnalyticsPage({ params: { domain } }: { params: { domain: string } }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavigationMenu domain={domain} />
      <div className="flex-grow flex justify-center p-4 relative">
        <div className="w-full max-w-6xl p-6">
          <Header className="w-full">
            <h1 className="text-3xl">Analytics</h1>
          </Header>
          <div className="flex flex-row gap-10 mt-20">
            <div className="w-full rounded-lg">
              <AnalyticsPageContent />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsPageContent() {
  const hasAnalyticsEntitlement = hasEntitlement("analytics");

  if (!hasAnalyticsEntitlement) {
    return <AnalyticsEntitlementMessage />;
  }

  return <AnalyticsContent />;
}
