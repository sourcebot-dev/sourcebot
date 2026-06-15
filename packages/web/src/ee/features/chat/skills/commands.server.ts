import type { AskCommandDefinition } from "@/features/chat/commands/types";
import { isServiceError } from "@/lib/utils";
import { listPersonalAgentSkillCommands } from "./actions";

export const listPersonalAgentSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listPersonalAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load personal agent skill commands:', commands);
        return [];
    }

    return commands;
}
