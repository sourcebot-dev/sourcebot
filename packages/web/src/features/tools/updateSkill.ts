import { z } from "zod";
import { checkAskEntitlement } from "@/features/chat/utils.server";
import { normalizeAgentSkillSlug } from "@/ee/features/chat/skills/types";
import { updateAgentSkillForContext } from "@/ee/features/chat/skills/skillCreation";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import { skillSettingsUrl, toSkillToolError, toSkillAnalyticsSource } from "./skillToolShared";
import description from "./updateSkill.txt";

// Same plain-string style as create_skill: the merged result is validated in
// the update core via agentSkillInputSchema.
const updateSkillShape = {
    slug: z.string().describe("Current slash command of the skill to update, without the leading '/'."),
    scope: z.enum(['personal', 'shared']).describe("Which catalog the skill lives in: 'personal' (your skills) or 'shared' (the organization catalog)."),
    name: z.string().optional().describe("New display name, 1-80 characters. Omit to keep the current name."),
    newSlug: z.string().optional().describe("New slash command, without the leading '/'. Lowercase letters, numbers, and hyphens; at most 64 characters. Omit to keep the current command."),
    description: z.string().optional().describe("New description of when to use the skill, 1-500 characters. Omit to keep the current description."),
    instructions: z.string().optional().describe("New markdown instructions, 1-20,000 characters. Omit to keep the current instructions."),
};

export type UpdateSkillMetadata = {
    id: string;
    slug: string;
    name: string;
    scope: 'personal' | 'shared';
    url: string;
};

export const updateSkillDefinition: ToolDefinition<"update_skill", typeof updateSkillShape, UpdateSkillMetadata> = {
    name: "update_skill",
    title: "Update skill",
    isReadOnly: false,
    isIdempotent: true,
    isDestructive: true,
    description,
    inputSchema: z.object(updateSkillShape),
    execute: async (input, context) => {
        logger.debug('update_skill', { slug: input.slug, scope: input.scope });

        const { slug, scope, name, newSlug, description: newDescription, instructions } = input;

        const result = await sew(() =>
            withAuth(async ({ org, user, prisma }) => {
                const askError = await checkAskEntitlement();
                if (askError) {
                    return askError;
                }

                return updateAgentSkillForContext({
                    prisma,
                    userId: user.id,
                    orgId: org.id,
                    target: { scope, slug: normalizeAgentSkillSlug(slug) },
                    fields: {
                        ...(name !== undefined ? { name } : {}),
                        ...(newSlug !== undefined ? { slug: newSlug } : {}),
                        ...(newDescription !== undefined ? { description: newDescription } : {}),
                        ...(instructions !== undefined ? { instructions } : {}),
                    },
                    policy: { sharedManageableBy: 'creator', allowSynced: false },
                    analytics: {
                        source: toSkillAnalyticsSource(context.source),
                        entryPoint: 'agent_tool',
                    },
                });
            }));

        if (isServiceError(result)) {
            logger.error('update_skill failed', { serviceError: result });
            throw toSkillToolError(result, {
                notAuthenticatedMessage: 'Authentication is required to update skills.',
                fallbackMessage: 'Failed to update skill.',
            });
        }

        const url = skillSettingsUrl(result.id);
        return {
            output: JSON.stringify({
                id: result.id,
                slug: result.slug,
                name: result.name,
                description: result.description,
                scope,
                enabled: result.enabled,
                updatedAt: result.updatedAt,
                url,
            }),
            metadata: {
                id: result.id,
                slug: result.slug,
                name: result.name,
                scope,
                url,
            },
        };
    },
};
