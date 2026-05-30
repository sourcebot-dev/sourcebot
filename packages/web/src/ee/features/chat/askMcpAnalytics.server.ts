import { getStoredMcpConnectionStatus } from "@/ee/features/chat/mcp/connectionStatus";
import { hasEntitlement } from "@/lib/entitlements";
import type { PrismaClient } from "@sourcebot/db";
import type { DynamicToolUIPart } from "ai";
import type { SBChatMessage, SBChatMessagePart } from "@/features/chat/types";
import { getTurnProgressState } from "@/features/chat/utils";

export type AskMcpAvailabilityAnalytics = {
    hasAskMcpServersAvailable: boolean;
    askMcpConnectedServerCount: number;
    askMcpEnabledServerCount: number;
    askMcpDisabledServerCount: number;
};

export type AskMcpTurnCompletedAnalytics = {
    traceId?: string;
    askMcpUsed: boolean;
    askMcpToolCallCount: number;
    askMcpToolSuccessCount: number;
    askMcpToolFailureCount: number;
    askMcpApprovalRequestedCount: number;
    askMcpApprovalDeniedCount: number;
    askMcpFailedServerCount: number;
    durationMs: number;
};

const emptyAskMcpAvailability: AskMcpAvailabilityAnalytics = {
    hasAskMcpServersAvailable: false,
    askMcpConnectedServerCount: 0,
    askMcpEnabledServerCount: 0,
    askMcpDisabledServerCount: 0,
};

type AskMcpAvailabilityPrismaClient = Pick<PrismaClient, "userMcpServer">;

export async function getAskMcpAvailabilityAnalytics({
    prisma,
    userId,
    orgId,
    disabledMcpServerIds,
}: {
    prisma: AskMcpAvailabilityPrismaClient;
    userId: string | undefined;
    orgId: number;
    disabledMcpServerIds: string[];
}): Promise<AskMcpAvailabilityAnalytics> {
    if (!userId || !(await hasEntitlement("ask"))) {
        return emptyAskMcpAvailability;
    }

    const userServers = await prisma.userMcpServer.findMany({
        where: {
            userId,
            tokens: { not: null },
            server: {
                orgId,
                clientInfo: { not: null },
            },
        },
        select: {
            serverId: true,
            tokens: true,
            tokensExpiresAt: true,
        },
    });

    const connectedServerIds = userServers
        .filter((userServer) =>
            getStoredMcpConnectionStatus(userServer.tokens, userServer.tokensExpiresAt).state === "connected"
        )
        .map((userServer) => userServer.serverId);
    const disabledServerIds = new Set(disabledMcpServerIds);
    const askMcpDisabledServerCount = connectedServerIds.filter((serverId) => disabledServerIds.has(serverId)).length;
    const askMcpEnabledServerCount = connectedServerIds.length - askMcpDisabledServerCount;

    return {
        hasAskMcpServersAvailable: askMcpEnabledServerCount > 0,
        askMcpConnectedServerCount: connectedServerIds.length,
        askMcpEnabledServerCount,
        askMcpDisabledServerCount,
    };
}

function isExternalMcpToolPart(part: SBChatMessagePart): part is SBChatMessagePart & DynamicToolUIPart {
    return part.type === "dynamic-tool" && part.toolName.startsWith("mcp_");
}

function hasApproval(part: DynamicToolUIPart) {
    return part.approval !== undefined;
}

export function getAskMcpTurnCompletedAnalytics({
    messages,
    availability,
}: {
    messages: SBChatMessage[];
    availability: AskMcpAvailabilityAnalytics;
}): AskMcpTurnCompletedAnalytics | undefined {
    const latestMessage = messages.at(-1);
    const latestAssistantMessage = latestMessage?.role === "assistant" ? latestMessage : undefined;
    if (!latestAssistantMessage) {
        return undefined;
    }

    const progressState = getTurnProgressState({ messages, status: "ready" });
    if (progressState.isTurnInProgress) {
        return undefined;
    }

    const externalMcpToolParts = latestAssistantMessage.parts.filter(isExternalMcpToolPart);
    const askMcpToolSuccessCount = externalMcpToolParts.filter((part) => part.state === "output-available").length;
    const askMcpToolFailureCount = externalMcpToolParts.filter((part) => part.state === "output-error").length;
    const askMcpToolCallCount = askMcpToolSuccessCount + askMcpToolFailureCount;
    const askMcpApprovalRequestedCount = externalMcpToolParts.filter(hasApproval).length;
    const askMcpApprovalDeniedCount = externalMcpToolParts.filter((part) => part.state === "output-denied").length;
    const askMcpFailedServerCount = latestAssistantMessage.parts.filter((part) =>
        part.type === "data-mcp-failed-server"
    ).length;

    const hasMcpTurnActivity = externalMcpToolParts.length > 0 || askMcpFailedServerCount > 0;
    if (!availability.hasAskMcpServersAvailable && !hasMcpTurnActivity) {
        return undefined;
    }

    return {
        traceId: latestAssistantMessage.metadata?.traceId,
        askMcpUsed: askMcpToolCallCount > 0,
        askMcpToolCallCount,
        askMcpToolSuccessCount,
        askMcpToolFailureCount,
        askMcpApprovalRequestedCount,
        askMcpApprovalDeniedCount,
        askMcpFailedServerCount,
        durationMs: latestAssistantMessage.metadata?.totalResponseTimeMs ?? 0,
    };
}
