import { auth } from "@/auth";
import { getConnectionStats, getOrgAccountRequests } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { OrgRole } from "@prisma/client";
import { SidebarBase } from "@/app/(app)/@sidebar/components/sidebarBase";
import { Nav } from "./nav";
import { ChatHistory } from "./chatHistory";
import { withAuth } from "@/middleware/withAuth";
import { sew } from "@/middleware/sew";

const SIDEBAR_CHAT_LIMIT = 30;

export async function DefaultSidebar() {
    const session = await auth();

    const chatHistory = session ? await getUserChatHistory() : [];
    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    const isSettingsNotificationVisible = await (async () => {
        if (!session) {
            return false;
        }
        const membership = await __unsafePrisma.userToOrg.findUnique({
            where: { orgId_userId: { orgId: SINGLE_TENANT_ORG_ID, userId: session.user.id } },
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
        <SidebarBase
            session={session}
            collapsible="icon"
            headerContent={<Nav isSettingsNotificationVisible={isSettingsNotificationVisible} isSignedIn={!!session} />}
        >
            <ChatHistory
                chatHistory={chatHistory.slice(0, SIDEBAR_CHAT_LIMIT)}
                hasMore={chatHistory.length > SIDEBAR_CHAT_LIMIT}
            />
        </SidebarBase>
    );
}

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