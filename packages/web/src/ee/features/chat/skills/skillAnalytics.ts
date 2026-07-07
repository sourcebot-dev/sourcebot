import type { PosthogEventMap } from "@/lib/posthogEvents";

type AskSkillInvokedEvent = PosthogEventMap['ask_skill_invoked'];
type AskSkillInvokedSource = AskSkillInvokedEvent['source'];

// Shared inputs across every ask_skill_invoked emission. `source` defaults to
// the agent; chatId/traceId/durationMs are present only where the call site has
// them (the auto path does; the manual path does not).
type AskSkillInvokedBase = {
    activationMethod: AskSkillInvokedEvent['activationMethod'];
    skillId: string;
    source?: AskSkillInvokedSource;
    chatId?: string;
    traceId?: string;
    durationMs?: number;
};

// Success carries the resolved skill's identity; failure cannot (the skill was
// never resolved), so slug/name/sourceLabel are intentionally absent there. The
// discriminated union encodes that divergence so it is enforced, not re-decided
// field-by-field at each call site.
type AskSkillInvokedInput =
    | (AskSkillInvokedBase & {
        success: true;
        slug: string;
        name: string;
        // Known for auto invocations; the manual command snapshot may omit it.
        sourceLabel?: string;
    })
    | (AskSkillInvokedBase & {
        success: false;
    });

const DEFAULT_SKILL_ANALYTICS_SOURCE: AskSkillInvokedSource = 'sourcebot-ask-agent';

/**
 * Single source of truth for the `ask_skill_invoked` event payload, shared by
 * the auto-invocation (load_skill) and manual slash-command paths so the event
 * shape cannot drift between them. Pass the result to `captureEvent`.
 */
export const buildAskSkillInvokedEvent = (input: AskSkillInvokedInput): AskSkillInvokedEvent => {
    const event: AskSkillInvokedEvent = {
        source: input.source ?? DEFAULT_SKILL_ANALYTICS_SOURCE,
        activationMethod: input.activationMethod,
        skillId: input.skillId,
        success: input.success,
        chatId: input.chatId,
        traceId: input.traceId,
        durationMs: input.durationMs,
    };

    if (input.success) {
        event.slug = input.slug;
        event.name = input.name;
        event.sourceLabel = input.sourceLabel;
    }

    return event;
};
