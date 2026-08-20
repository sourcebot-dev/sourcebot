import { z } from "zod";
import { checkAskEntitlement } from "@/features/chat/utils.server";
import { listAgentSkillsForContext } from "@/ee/features/chat/skills/skillListing";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import { toSkillToolError } from "./skillToolShared";
import description from "./listSkills.txt";

const listSkillsShape = {
    scope: z.enum(['personal', 'shared']).optional().describe("Filter to one catalog: 'personal' or 'shared'. Omit to list both."),
};

export type ListSkillsMetadata = {
    count: number;
};

export const listSkillsDefinition: ToolDefinition<"list_skills", typeof listSkillsShape, ListSkillsMetadata> = {
    name: "list_skills",
    title: "List skills",
    isReadOnly: true,
    isIdempotent: true,
    isDestructive: false,
    description,
    inputSchema: z.object(listSkillsShape),
    execute: async (input, _context) => {
        logger.debug('list_skills', input);

        const result = await sew(() =>
            withAuth(async ({ org, user, prisma }) => {
                const askError = await checkAskEntitlement();
                if (askError) {
                    return askError;
                }

                return listAgentSkillsForContext({
                    prisma,
                    userId: user.id,
                    orgId: org.id,
                    scope: input.scope,
                });
            }));

        if (isServiceError(result)) {
            logger.error('list_skills failed', { serviceError: result });
            throw toSkillToolError(result, {
                notAuthenticatedMessage: 'Authentication is required to list skills.',
                fallbackMessage: 'Failed to list skills.',
            });
        }

        return {
            output: JSON.stringify({ skills: result }),
            metadata: {
                count: result.length,
            },
        };
    },
};
