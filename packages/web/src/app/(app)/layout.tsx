/**
 * All routes under (app) are dynamic since the layout calls auth() and
 * accesses headers.
 */
export const dynamic = 'force-dynamic';

import { __unsafePrisma } from "@/prisma";
import { auth } from "@/auth";
import { isServiceError } from "@/lib/utils";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { OnboardGuard } from "./components/onboardGuard";
import { cookies, headers } from "next/headers";
import { getSelectorsByUserAgent } from "react-device-detect";
import { MobileUnsupportedSplashScreen } from "./components/mobileUnsupportedSplashScreen";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./components/syntaxGuideProvider";
import { notFound, redirect } from "next/navigation";
import { PendingApprovalCard } from "./components/pendingApproval";
import { SubmitJoinRequest } from "./components/submitJoinRequest";
import { hasEntitlement } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { GcpIapAuth } from "./components/gcpIapAuth";
import { getAnonymousAccessStatus, getConnectionStats, getMemberApprovalRequired, getOrgAccountRequests } from "@/actions";
import { JoinOrganizationCard } from "@/app/components/joinOrganizationCard";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { GitHubStarToast } from "./components/githubStarToast";
import { UpgradeToast } from "./components/upgradeToast";
import { getLinkedAccounts } from "@/ee/features/sso/actions";
import { PermissionSyncBanner } from "./components/permissionSyncBanner";
import { getPermissionSyncStatus } from "../api/(server)/ee/permissionSyncStatus/api";
import { ServiceErrorException } from "@/lib/serviceError";
import { ConnectAccountsCard } from "@/ee/features/sso/components/connectAccountsCard";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/appSidebar";
import { SidebarOverrideProvider } from "./components/appSidebar/sidebarOverrideContext";
import { getUserChatHistory } from "@/features/chat/actions";

interface LayoutProps {
    children: React.ReactNode,
}

export default async function Layout(props: LayoutProps) {
    const {
        children
    } = props;

    const org = await __unsafePrisma.org.findUnique({
        where: { id: SINGLE_TENANT_ORG_ID },
    });

    if (!org) {
        return notFound();
    }

    const session = await auth();
    const anonymousAccessEnabled = await (async () => {
        if (!hasEntitlement("anonymous-access")) {
            return false;
        }

        const status = await getAnonymousAccessStatus();
        if (isServiceError(status)) {
            return false;
        }

        return status;
    })();

    // If the user is authenticated, we must check if they're a member of the org
    if (session) {
        const membership = await __unsafePrisma.userToOrg.findUnique({
            where: {
                orgId_userId: {
                    orgId: org.id,
                    userId: session.user.id
                }
            },
            include: {
                user: true
            }
        });

        // There's two reasons why a user might not be a member of an org:
        // 1. The org doesn't require member approval, but the org was at max capacity when the user registered. In this case, we show them
        // the join organization card to allow them to join the org if seat capacity is freed up. This card handles checking if the org has available seats.
        // 2. The org requires member approval, and they haven't been approved yet. In this case, we allow them to submit a request to join the org.
        if (!membership) {
            const memberApprovalRequired = await getMemberApprovalRequired();
            if (!memberApprovalRequired) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                        <JoinOrganizationCard />
                    </div>
                )
            } else {
                const hasPendingApproval = await __unsafePrisma.accountRequest.findFirst({
                    where: {
                        orgId: org.id,
                        requestedById: session.user.id
                    }
                });

                if (hasPendingApproval) {
                    return <PendingApprovalCard />
                } else {
                    return <SubmitJoinRequest />
                }
            }
        }
    } else {
        // If the user isn't authenticated and anonymous access isn't enabled, we need to redirect them to the login page.
        if (!anonymousAccessEnabled) {
            const ssoEntitlement = await hasEntitlement("sso");
            if (ssoEntitlement && env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
                return <GcpIapAuth callbackUrl="/" />;
            } else {
                redirect('/login');
            }
        }
    }

    // If the org is not onboarded, and GCP IAP is not enabled, show the onboarding page
    if (!org.isOnboarded && !(env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE)) {
        return (
            <OnboardGuard>
                {children}
            </OnboardGuard>
        )
    }

    if (session && hasEntitlement("sso")) {
        const linkedAccounts = await getLinkedAccounts();
        if (isServiceError(linkedAccounts)) {
            throw new ServiceErrorException(linkedAccounts);
        }

        // First, grab a list of all unlinked providers.
        const unlinkedProviders = linkedAccounts.filter(a => !a.isLinked && a.isAccountLinkingProvider);
        if (unlinkedProviders.length > 0) {
            const cookieStore = await cookies();
            const hasSkippedOptional = cookieStore.has(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME);

            const hasRequiredUnlinkedProviders = unlinkedProviders.some(a => a.required);
            if (hasRequiredUnlinkedProviders || !hasSkippedOptional) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                        <ConnectAccountsCard linkedAccounts={linkedAccounts} callbackUrl="/" />
                    </div>
                )
            }
        }
    }

    const headersList = await headers();
    const cookieStore = await cookies()
    const userAgent = headersList.get('user-agent');
    const { isMobile } = getSelectorsByUserAgent(userAgent ?? '');

    if (isMobile && !cookieStore.has(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME)) {
        return (
            <MobileUnsupportedSplashScreen />
        )
    }
    const isPermissionSyncBannerVisible = session && hasEntitlement("permission-syncing");
    const hasPendingFirstSync = isPermissionSyncBannerVisible ? (await getPermissionSyncStatus()) : null;

    const chatHistory = session ? await getUserChatHistory() : [];
    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    // Compute sidebar notification flags
    const isSettingsNotificationVisible = await (async () => {
        if (!session) {
            return false;
        }
        const membership = await __unsafePrisma.userToOrg.findUnique({
            where: { orgId_userId: { orgId: org.id, userId: session.user.id } },
            select: { role: true },
        });
        if (membership?.role !== OrgRole.OWNER) {
            return false;
        }
        const connectionStats = await getConnectionStats();
        const joinRequests = await getOrgAccountRequests();
        const hasConnectionNotification = !isServiceError(connectionStats) && connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0;
        const hasJoinRequestNotification = !isServiceError(joinRequests) && joinRequests.length > 0;
        return hasConnectionNotification || hasJoinRequestNotification;
    })();

    return (
        <SyntaxGuideProvider>
            {
                isPermissionSyncBannerVisible ? (
                    <PermissionSyncBanner
                        initialHasPendingFirstSync={(isServiceError(hasPendingFirstSync) || hasPendingFirstSync === null) ?
                            false :
                            hasPendingFirstSync.hasPendingFirstSync
                        }
                    />
                ) : null
            }
            <div className="fixed inset-0 flex bg-shell">
                <SidebarOverrideProvider>
                    <SidebarProvider defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}>
                        <AppSidebar
                            session={session}
                            chatHistory={chatHistory}
                            isSettingsNotificationVisible={isSettingsNotificationVisible}
                        />
                        <div className="flex-1 min-h-0 flex flex-col pt-2 pb-2 pr-2">
                            <div className="flex-1 min-h-0 bg-background flex flex-col border border-[#1d1d1f] rounded-xl">
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </SidebarProvider>
                </SidebarOverrideProvider>
            </div>
            <SyntaxReferenceGuide />
            <GitHubStarToast />
            {env.EXPERIMENT_ASK_GH_ENABLED !== 'true' && <UpgradeToast />}
        </SyntaxGuideProvider>
    )
}