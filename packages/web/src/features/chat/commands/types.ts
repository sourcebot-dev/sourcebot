import { z } from "zod";

export const ASK_COMMAND_SOURCE_PERSONAL_SKILL = "personal-skill";
export const ASK_COMMAND_SOURCE_SHARED_SKILL = "shared-skill";

export type AskCommandDefinition = {
    id: string;
    // The registry/source that owns this command, not its execution type.
    sourceId: string;
    slug: string;
    name: string;
    description: string;
    sourceLabel?: string;
    isSynced?: boolean;
    aliases?: string[];
    isHidden?: boolean;
}

export type AskCommandSuggestion = AskCommandDefinition & {
    type: 'command';
}

// Snapshot data for rendering/restoring the editor chip. Execution should
// resolve the command definition by sourceId + commandId in a later layer.
export const commandMentionDataSchema = z.object({
    type: z.literal('command'),
    commandId: z.string(),
    // The registry/source that owns this command, not its execution type.
    sourceId: z.string(),
    slug: z.string(),
    name: z.string(),
    sourceLabel: z.string().optional(),
});

export type CommandMentionData = z.infer<typeof commandMentionDataSchema>;

export const isCommandMentionData = (value: unknown): value is CommandMentionData =>
    commandMentionDataSchema.safeParse(value).success;

export const commandInvocationDataSchema = commandMentionDataSchema.extend({
    expandedText: z.string().optional(),
    // Server-assigned outcome of resolving the command to its executable text.
    resolutionStatus: z.enum(["success", "failure"]).optional(),
});

export type CommandInvocationData = z.infer<typeof commandInvocationDataSchema>;
