import { z } from "zod";
import { checkAskEntitlement } from "@/features/chat/utils.server";
import { agentSkillInputSchema } from "@/ee/features/chat/skills/types";
import { createPersonalAgentSkillForContext } from "@/ee/features/chat/skills/skillCreation";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import { skillSettingsUrl, toSkillToolError, toSkillAnalyticsSource } from "./skillToolShared";
import description from "./createSkill.txt";

// Plain described strings rather than the piped slug schema: the AI SDK
// converts piped zod schemas to `allOf` JSON schemas in the model-facing tool
// definition, so validation runs in `execute` via agentSkillInputSchema instead
// (same rules and messages as the settings UI).
const createSkillShape = {
    name: z.string().describe("Display name for the skill, 1-80 characters."),
    slug: z.string().describe("Slash command for the skill, without the leading '/'. Lowercase letters, numbers, and hyphens; at most 64 characters (e.g. 'review-pr')."),
    description: z.string().describe("When to use the skill, 1-500 characters. Shown in the skill catalog the agent uses to auto-load skills."),
    instructions: z.string().describe("Markdown instructions the agent follows when the skill is invoked, 1-20,000 characters."),
};

export type CreateSkillMetadata = {
    id: string;
    slug: string;
    name: string;
    url: string;
};

export const createSkillDefinition: ToolDefinition<"create_skill", typeof createSkillShape, CreateSkillMetadata> = {
    name: "create_skill",
    title: "Create skill",
    isReadOnly: false,
    isIdempotent: false,
    isDestructive: false,
    description,
    inputSchema: z.object(createSkillShape),
    execute: async (input, context) => {
        logger.debug('create_skill', { slug: input.slug });

        const parsed = agentSkillInputSchema.safeParse(input);
        if (!parsed.success) {
            throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
        }

        const result = await sew(() =>
            withAuth(async ({ org, user, prisma }) => {
                const askError = await checkAskEntitlement();
                if (askError) {
                    return askError;
                }

                return createPersonalAgentSkillForContext({
                    prisma,
                    userId: user.id,
                    orgId: org.id,
                    input: parsed.data,
                    analytics: {
                        source: toSkillAnalyticsSource(context.source),
                        entryPoint: 'agent_tool',
                        creationMethod: 'manual',
                    },
                });
            }));

        if (isServiceError(result)) {
            logger.error('create_skill failed', { serviceError: result });
            throw toSkillToolError(result, {
                notAuthenticatedMessage: 'Authentication is required to create skills.',
                fallbackMessage: 'Failed to create skill.',
            });
        }

        const url = skillSettingsUrl(result.id);
        return {
            output: JSON.stringify({
                id: result.id,
                slug: result.slug,
                name: result.name,
                description: result.description,
                enabled: result.enabled,
                createdAt: result.createdAt,
                url,
            }),
            metadata: {
                id: result.id,
                slug: result.slug,
                name: result.name,
                url,
            },
        };
    },
};
