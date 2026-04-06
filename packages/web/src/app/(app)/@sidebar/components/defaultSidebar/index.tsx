import { auth } from "@/auth";
import { getUserChatHistory } from "@/features/chat/actions";
import { getConnectionStats, getOrgAccountRequests } from "@/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { OrgRole } from "@prisma/client";
import { SidebarBase } from "@/app/(app)/@sidebar/components/sidebarBase";
import { Nav } from "./nav";
import { ChatHistory } from "./chatHistory";

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
            headerContent={<Nav isSettingsNotificationVisible={isSettingsNotificationVisible} />}
        >
            <ChatHistory chatHistory={chatHistory} />
        </SidebarBase>
    );
}
