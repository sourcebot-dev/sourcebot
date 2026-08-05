import { cookies } from "next/headers";
import { auth } from "@/auth";
import { HOME_VIEW_COOKIE_NAME } from "@/lib/constants";
import { HomeView } from "@/hooks/useHomeView";
import { getConnectionStats } from "@/actions";
import { getOrgAccountRequests } from "@/features/membership/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { OrgRole } from "@prisma/client";
import { SidebarBase } from "@/app/(app)/@sidebar/components/sidebarBase";
import { Nav } from "./nav";
import { ChatHistory } from "./chatHistory";
import { RepoVisitHistory } from "./repoVisitHistory";
import { getAuthContext, withAuth } from "@/middleware/withAuth";
import { sew } from "@/middleware/sew";
import { hasEntitlement, isValidLicenseActive } from "@/lib/entitlements";
import { env } from "@sourcebot/shared";

const SIDEBAR_CHAT_LIMIT = 30;
export const SIDEBAR_REPO_VISITS_LIMIT = 10;

export async function DefaultSidebar() {
    const session = await auth();
    const cookieStore = await cookies();
    const homeView = (cookieStore.get(HOME_VIEW_COOKIE_NAME)?.value ?? "search") as HomeView;

    // Chat history is part of the Ask experience; hide it when the deployment
    // is not on a plan that includes Ask.
    const hasAskEntitlement = await hasEntitlement('ask');
    const chatHistory = (session && hasAskEntitlement) ? await getUserChatHistory() : [];
    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    const repoVisits = session ? await getRecentRepoVisits() : [];
    if (isServiceError(repoVisits)) {
        throw new ServiceErrorException(repoVisits);
    }

    const licenseActive = await isValidLicenseActive();

    const authContext = await getAuthContext();
    const isOwner = !isServiceError(authContext) && authContext.role === OrgRole.OWNER;

    const isSettingsNotificationVisible = await (async () => {
        if (!isOwner) {
            return false;
        }
        const connectionStats = await getConnectionStats();
        const joinRequests = await getOrgAccountRequests();
        const hasConnectionNotification = !isServiceError(connectionStats) && connectionStats.numberOfConnectionsWithFirstTimeSyncJobsInProgress > 0;
        const hasJoinRequestNotification = !isServiceError(joinRequests) && joinRequests.length > 0;
        return hasConnectionNotification || hasJoinRequestNotification;
    })();

    return (
        <SidebarBase
            session={session}
            collapsible="icon"
            isValidLicenseActive={licenseActive}
            isAskGhEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
            headerContent={
                <Nav
                    isSettingsNotificationVisible={isSettingsNotificationVisible}
                    isSignedIn={!!session}
                    homeView={homeView}
                />
            }
        >
            <RepoVisitHistory repoVisits={repoVisits} />
            {hasAskEntitlement && (
                <ChatHistory
                    chatHistory={chatHistory.slice(0, SIDEBAR_CHAT_LIMIT)}
                    hasMore={chatHistory.length > SIDEBAR_CHAT_LIMIT}
                />
            )}
        </SidebarBase>
    );
}

const getRecentRepoVisits = async () => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const visits = await prisma.repoVisit.findMany({
            where: {
                userId: user.id,
                orgId: org.id,
            },
            orderBy: {
                lastPromotedAt: 'desc',
            },
            take: SIDEBAR_REPO_VISITS_LIMIT,
            include: {
                repo: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        imageUrl: true,
                        external_codeHostType: true,
                    },
                },
            },
        });

        return visits.map((visit) => ({
            repoId: visit.repo.id,
            repoName: visit.repo.name,
            displayName: visit.repo.displayName,
            imageUrl: visit.repo.imageUrl,
            codeHostType: visit.repo.external_codeHostType,
        }));
    })
);

const getUserChatHistory = async () => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const chats = await prisma.chat.findMany({
            where: {
                orgId: org.id,
                createdById: user.id,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            take: SIDEBAR_CHAT_LIMIT + 1,
        });

        return chats.map((chat) => ({
            id: chat.id,
            createdAt: chat.createdAt,
            name: chat.name,
            visibility: chat.visibility,
        }))
    })
);