import type { PrismaClient } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { tool, type Tool } from "ai";
import { z } from "zod";
import _dedent from "dedent";
import { captureEvent } from "@/lib/posthog";
import type { AskMcpAnalyticsSource } from "@/lib/posthogEvents";
import { buildAskSkillInvokedEvent, skillScopeFromSourceId } from "../skills/skillAnalytics";
import { resolveAutoInvocableSkill } from "../skills/registry";

const dedent = _dedent.withOptions({ alignValues: true });

const logger = createLogger('load-skill-tool');

// Stable name of the auto-invocation tool. Referenced by the `<agent_skills>`
// system-prompt block so the model knows what to call.
export const LOAD_SKILL_TOOL_NAME = "load_skill";

interface LoadSkillToolAnalyticsContext {
    chatId?: string;
    traceId?: string;
    source?: AskMcpAnalyticsSource;
}

interface CreateLoadSkillToolOptions {
    prisma: PrismaClient;
    userId: string;
    orgId: number;
    analyticsContext?: LoadSkillToolAnalyticsContext;
}

/**
 * Single-phase skill loader, modelled on Claude Code's `Skill` tool. The model
 * discovers skills from the `<agent_skills>` catalog in the system prompt, then
 * calls this tool with the skill's id to load its (auth-checked) instructions as
 * the tool result. Unlike MCP tools, a
 * skill is an instruction blob rather than a callable tool with its own schema,
 * so it does not need to be promoted into `activeTools` — one call returns the
 * instructions directly. This keeps the tool set static across steps, so the
 * prompt cache is never invalidated by skill loading.
 */
export const createLoadSkillTool = ({
    prisma,
    userId,
    orgId,
    analyticsContext,
}: CreateLoadSkillToolOptions): Tool =>
    tool({
        description: dedent`
        Load the instructions for one of the skills listed in the <agent_skills> section of the system prompt, then follow them.
        Call this when the user's request matches a skill's description. Pass the skill's exact id from the catalog.
        After the tool returns, treat the returned instructions as authoritative guidance for completing the task.

        Examples:
          CORRECT: load_skill({ skill_id: "ckz9q..." })
          INCORRECT: load_skill({ skill_id: "audit billing issues" })   // not an id from the catalog
        `,
        inputSchema: z.object({
            skill_id: z.string().describe('Exact skill id from the <agent_skills> catalog, e.g. "ckz9q1a2b0000xyz".'),
        }),
        execute: async ({ skill_id }) => {
            const startTime = Date.now();

            // Both failure paths — an unknown/unauthorized id and a transient
            // lookup error — must fail closed identically: emit a success:false
            // event and return a generic message that never reveals why it failed.
            const captureFailure = (failureReason: string) => {
                void captureEvent('ask_skill_invoked', buildAskSkillInvokedEvent({
                    activationMethod: 'auto',
                    skillId: skill_id,
                    success: false,
                    failureReason,
                    source: analyticsContext?.source,
                    chatId: analyticsContext?.chatId,
                    traceId: analyticsContext?.traceId,
                    durationMs: Date.now() - startTime,
                }));
            };

            try {
                const skill = await resolveAutoInvocableSkill({ prisma, userId, orgId, skillId: skill_id });

                if (!skill) {
                    // Fail closed without leaking whether the id exists: the model
                    // simply learns this skill is not available to auto-invoke.
                    captureFailure('not_found_or_unauthorized');
                    return {
                        error: 'That skill is not available. Use only the skills listed in the <agent_skills> section, referencing their exact id.',
                    };
                }

                const instructions = skill.instructions;

                void captureEvent('ask_skill_invoked', buildAskSkillInvokedEvent({
                    activationMethod: 'auto',
                    skillId: skill.id,
                    success: true,
                    scope: skillScopeFromSourceId(skill.sourceId),
                    isSynced: skill.isSynced,
                    source: analyticsContext?.source,
                    chatId: analyticsContext?.chatId,
                    traceId: analyticsContext?.traceId,
                    durationMs: Date.now() - startTime,
                }));

                return {
                    skill: {
                        id: skill.id,
                        slug: skill.slug,
                        name: skill.name,
                    },
                    instructions,
                };
            } catch (error) {
                // A transient failure (DB error, pool exhaustion) must fail closed
                // the same way an unknown id does — the raw error must never reach
                // the model. Log it server-side so the failure stays observable.
                logger.error('Failed to load skill for auto-invocation.', {
                    skillId: skill_id,
                    error: error instanceof Error ? error.message : String(error),
                });
                captureFailure('load_error');
                return {
                    error: 'That skill could not be loaded right now. You can retry once, or continue without it.',
                };
            }
        },
    });
