import { createHash } from "node:crypto";
import { ASK_COMMAND_SOURCE_SHARED_SKILL } from "@/features/chat/commands/types";
import type {
    AskSkillEntryPoint,
    AskSkillScope,
    PosthogEventMap,
} from "@/lib/posthogEvents";
import type { AgentSkillVisibility } from "@sourcebot/db";

type AskSkillInvokedEvent = PosthogEventMap['ask_skill_invoked'];
type AskSkillInvokedSource = AskSkillInvokedEvent['source'];

const VALID_SKILL_ENTRY_POINTS = new Set<AskSkillEntryPoint>([
    'skills_settings',
    'account_ask_agent_settings',
    'workspace_ask_agent_settings',
    'chat_box',
    'unknown',
]);

// Shared inputs across every ask_skill_invoked emission. `source` defaults to
// the agent; chatId/traceId/durationMs are present only where the call site has
// them (the auto path does; the manual path does not).
type AskSkillInvokedBase = {
    activationMethod: AskSkillInvokedEvent['activationMethod'];
    skillId: string;
    scope?: AskSkillScope;
    isSynced?: boolean;
    source?: AskSkillInvokedSource;
    chatId?: string;
    traceId?: string;
    durationMs?: number;
};

type AskSkillInvokedInput =
    | (AskSkillInvokedBase & {
        success: true;
    })
    | (AskSkillInvokedBase & {
        success: false;
        failureReason?: string;
    });

const DEFAULT_SKILL_ANALYTICS_SOURCE: AskSkillInvokedSource = 'sourcebot-ask-agent';

export const hashSkillId = (skillId: string): string =>
    createHash('sha256').update(skillId).digest('hex');

export const normalizeSkillAnalyticsEntryPoint = (
    entryPoint: AskSkillEntryPoint | undefined,
): AskSkillEntryPoint => {
    if (entryPoint && VALID_SKILL_ENTRY_POINTS.has(entryPoint)) {
        return entryPoint;
    }

    return 'unknown';
};

export const skillScopeFromSourceId = (sourceId: string): AskSkillScope =>
    sourceId === ASK_COMMAND_SOURCE_SHARED_SKILL ? 'shared' : 'personal';

export const skillScopeFromVisibility = (visibility: AgentSkillVisibility): AskSkillScope =>
    visibility === 'SHARED' ? 'shared' : 'personal';

/**
 * Single source of truth for the `ask_skill_invoked` event payload, shared by
 * the auto-invocation (load_skill) and manual slash-command paths so the event
 * shape cannot drift between them. Pass the result to `captureEvent`.
 */
export const buildAskSkillInvokedEvent = (input: AskSkillInvokedInput): AskSkillInvokedEvent => {
    const event: AskSkillInvokedEvent = {
        source: input.source ?? DEFAULT_SKILL_ANALYTICS_SOURCE,
        activationMethod: input.activationMethod,
        skillIdHash: hashSkillId(input.skillId),
        scope: input.scope,
        isSynced: input.isSynced,
        success: input.success,
        chatId: input.chatId,
        traceId: input.traceId,
        durationMs: input.durationMs,
    };

    if (!input.success) {
        event.failureReason = input.failureReason;
    }

    return event;
};
