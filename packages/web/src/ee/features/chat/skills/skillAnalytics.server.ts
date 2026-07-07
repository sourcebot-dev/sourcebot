import "server-only";

import { commandInvocationDataSchema } from "@/features/chat/commands/types";
import type { SBChatMessage, SBChatMessagePart } from "@/features/chat/types";
import { getTurnProgressState } from "@/features/chat/utils";
import { hasEntitlement } from "@/lib/entitlements";
import type { PrismaClient } from "@sourcebot/db";
import { buildSkillRegistry } from "./registry";

export type AskSkillAvailabilityAnalytics = {
    availableSkillCount: number;
};

export type AskSkillTurnCompletedAnalytics = {
    traceId?: string;
    availableSkillCount: number;
    manualInvocationCount: number;
    autoInvocationCount: number;
    successfulInvocationCount: number;
    failedInvocationCount: number;
    uniqueSkillCount: number;
    durationMs: number;
};

const emptyAskSkillAvailability: AskSkillAvailabilityAnalytics = {
    availableSkillCount: 0,
};

type AskSkillAvailabilityPrismaClient = Pick<PrismaClient, "agentSkill" | "repo">;

export async function getAskSkillAvailabilityAnalytics({
    prisma,
    userId,
    orgId,
}: {
    prisma: AskSkillAvailabilityPrismaClient;
    userId: string | undefined;
    orgId: number;
}): Promise<AskSkillAvailabilityAnalytics> {
    if (!userId || !(await hasEntitlement("ask"))) {
        return emptyAskSkillAvailability;
    }

    const skillRegistry = await buildSkillRegistry({
        prisma: prisma as PrismaClient,
        userId,
        orgId,
    }).catch(() => []);

    return {
        availableSkillCount: skillRegistry.length,
    };
}

type LoadSkillToolPart = SBChatMessagePart & {
    type: "tool-load_skill";
    state?: string;
    input?: unknown;
    output?: unknown;
};

const isLoadSkillToolPart = (part: SBChatMessagePart): part is LoadSkillToolPart =>
    part.type === "tool-load_skill";

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isLoadSkillSuccess = (part: LoadSkillToolPart) =>
    part.state === "output-available" && isObject(part.output) && !("error" in part.output);

const isLoadSkillFailure = (part: LoadSkillToolPart) =>
    part.state === "output-error" || (part.state === "output-available" && isObject(part.output) && "error" in part.output);

const getLoadedSkillId = (part: LoadSkillToolPart): string | undefined => {
    if (part.state !== "output-available" || !isObject(part.output) || "error" in part.output) {
        return undefined;
    }

    const skill = part.output.skill;
    if (!isObject(skill) || typeof skill.id !== "string") {
        return undefined;
    }

    return skill.id;
};

const getManualCommandSkillId = (part: SBChatMessagePart): string | undefined => {
    if (part.type !== "data-command") {
        return undefined;
    }

    const parsed = commandInvocationDataSchema.safeParse(part.data);
    return parsed.success ? parsed.data.commandId : undefined;
};

export function getAskSkillTurnCompletedAnalytics({
    messages,
    availability,
}: {
    messages: SBChatMessage[];
    availability: AskSkillAvailabilityAnalytics;
}): AskSkillTurnCompletedAnalytics | undefined {
    const latestMessage = messages.at(-1);
    const latestAssistantMessage = latestMessage?.role === "assistant" ? latestMessage : undefined;
    if (!latestAssistantMessage) {
        return undefined;
    }

    const progressState = getTurnProgressState({ messages, status: "ready" });
    if (progressState.isTurnInProgress) {
        return undefined;
    }

    const latestAssistantIndex = messages.length - 1;
    const latestUserMessage = [...messages.slice(0, latestAssistantIndex)].reverse()
        .find((message) => message.role === "user");
    const manualSkillIds = latestUserMessage?.parts
        .map(getManualCommandSkillId)
        .filter((skillId): skillId is string => skillId !== undefined) ?? [];

    const loadSkillToolParts = latestAssistantMessage.parts.filter(isLoadSkillToolPart);
    const autoSkillIds = loadSkillToolParts
        .map(getLoadedSkillId)
        .filter((skillId): skillId is string => skillId !== undefined);
    const autoSuccessCount = loadSkillToolParts.filter(isLoadSkillSuccess).length;
    const autoFailureCount = loadSkillToolParts.filter(isLoadSkillFailure).length;
    const autoInvocationCount = autoSuccessCount + autoFailureCount;
    const manualInvocationCount = manualSkillIds.length;
    const uniqueSkillCount = new Set([...manualSkillIds, ...autoSkillIds]).size;

    if (availability.availableSkillCount === 0 && manualInvocationCount === 0 && autoInvocationCount === 0) {
        return undefined;
    }

    return {
        traceId: latestAssistantMessage.metadata?.traceId,
        availableSkillCount: availability.availableSkillCount,
        manualInvocationCount,
        autoInvocationCount,
        successfulInvocationCount: manualInvocationCount + autoSuccessCount,
        failedInvocationCount: autoFailureCount,
        uniqueSkillCount,
        durationMs: latestAssistantMessage.metadata?.totalResponseTimeMs ?? 0,
    };
}
