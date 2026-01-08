import { prisma } from "@/prisma";
import { auth } from "@/auth";
import { getOrgFromDomain } from "@/data/org";
import { isServiceError } from "@/lib/utils";
import { OnboardGuard } from "./components/onboardGuard";
import { UpgradeGuard } from "./components/upgradeGuard";
import { cookies, headers } from "next/headers";
import { getSelectorsByUserAgent } from "react-device-detect";
import { MobileUnsupportedSplashScreen } from "./components/mobileUnsupportedSplashScreen";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME } from "@/lib/constants";
import { SyntaxReferenceGuide } from "./components/syntaxReferenceGuide";
import { SyntaxGuideProvider } from "./components/syntaxGuideProvider";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { notFound, redirect } from "next/navigation";
import { getSubscriptionInfo } from "@/ee/features/billing/actions";
import { PendingApprovalCard } from "./components/pendingApproval";
import { SubmitJoinRequest } from "./components/submitJoinRequest";
import { hasEntitlement } from "@sourcebot/shared";
import { env } from "@sourcebot/shared";
import { GcpIapAuth } from "./components/gcpIapAuth";
import { getAnonymousAccessStatus, getMemberApprovalRequired } from "@/actions";
import { JoinOrganizationCard } from "@/app/components/joinOrganizationCard";
import { LogoutEscapeHatch } from "@/app/components/logoutEscapeHatch";
import { GitHubStarToast } from "./components/githubStarToast";
import { UpgradeToast } from "./components/upgradeToast";
import { getLinkedAccountProviderStates } from "@/ee/features/permissionSyncing/actions";
import { LinkAccounts } from "@/ee/features/permissionSyncing/components/linkAccounts";

interface LayoutProps {
    children: React.ReactNode,
    params: Promise<{ domain: string }>
}

export default async function Layout(props: LayoutProps) {
    const params = await props.params;

    const {
        domain
    } = params;

    const {
        children
    } = props;

    const org = await getOrgFromDomain(domain);

    if (!org) {
        return notFound();
    }

    const session = await auth();
    const anonymousAccessEnabled = await (async () => {
        if (!hasEntitlement("anonymous-access")) {
            return false;
        }

        const status = await getAnonymousAccessStatus(domain);
        if (isServiceError(status)) {
            return false;
        }

        return status;
    })();

    // If the user is authenticated, we must check if they're a member of the org
    if (session) {
        const membership = await prisma.userToOrg.findUnique({
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
            const memberApprovalRequired = await getMemberApprovalRequired(domain);
            if (!memberApprovalRequired) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                        <JoinOrganizationCard />
                    </div>
                )
            } else {
                const hasPendingApproval = await prisma.accountRequest.findFirst({
                    where: {
                        orgId: org.id,
                        requestedById: session.user.id
                    }
                });
                
                if (hasPendingApproval) {
                    return <PendingApprovalCard />
                } else {
                    return <SubmitJoinRequest domain={domain} />
                }
            }
        }
    } else {
        // If the user isn't authenticated and anonymous access isn't enabled, we need to redirect them to the login page.
        if (!anonymousAccessEnabled) {
            const ssoEntitlement = await hasEntitlement("sso");
            if (ssoEntitlement && env.AUTH_EE_GCP_IAP_ENABLED && env.AUTH_EE_GCP_IAP_AUDIENCE) {
                return <GcpIapAuth callbackUrl={`/${domain}`} />;
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

    if (hasEntitlement("permission-syncing")) {
        const linkedAccountProviderStates = await getLinkedAccountProviderStates();
        if (isServiceError(linkedAccountProviderStates)) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-6">
                    <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                    <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md w-full text-center">
                        <h2 className="text-lg font-semibold text-red-800 mb-2">An error occurred</h2>
                        <p className="text-red-700 mb-1">
                            {typeof linkedAccountProviderStates.message === 'string'
                                ? linkedAccountProviderStates.message
                                : "A server error occurred while checking your account status. Please try again or contact support."}
                        </p>
                    </div>
                </div>
            )
        }

        const hasUnlinkedProviders = linkedAccountProviderStates.some(state => state.isLinked === false);
        if (hasUnlinkedProviders) {
            const cookieStore = await cookies();
            const hasSkippedOptional = cookieStore.has(OPTIONAL_PROVIDERS_LINK_SKIPPED_COOKIE_NAME);

            const hasUnlinkedRequiredProviders = linkedAccountProviderStates.some(state => state.required && !state.isLinked)
            const shouldShowLinkAccounts = hasUnlinkedRequiredProviders || !hasSkippedOptional;
            if (shouldShowLinkAccounts) {
                return (
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <LogoutEscapeHatch className="absolute top-0 right-0 p-6" />
                        <LinkAccounts linkedAccountProviderStates={linkedAccountProviderStates} callbackUrl={`/${domain}`}/>
                    </div>
                )
            }
        }
    }

    if (IS_BILLING_ENABLED) {
        const subscription = await getSubscriptionInfo(domain);
        if (
            subscription &&
            (
                isServiceError(subscription) ||
                (subscription.status !== "active" && subscription.status !== "trialing")
            )
        ) {
            return (
                <UpgradeGuard>
                    {children}
                </UpgradeGuard>
            )
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
    return (
        <SyntaxGuideProvider>
            {children}
            <SyntaxReferenceGuide />
            <GitHubStarToast />
            <UpgradeToast />
        </SyntaxGuideProvider>
    )
}