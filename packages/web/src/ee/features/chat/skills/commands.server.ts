import type { AskCommandDefinition } from "@/features/chat/commands/types";
import { isServiceError } from "@/lib/utils";
import { listAgentSkillCommands, listOrgAgentSkillCommands, listPersonalAgentSkillCommands } from "./actions";

export const listPersonalAgentSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listPersonalAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load personal agent skill commands:', commands);
        return [];
    }

    return commands;
}

export const listOrgSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listOrgAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load org agent skill commands:', commands);
        return [];
    }

    return commands;
}

export const listAgentSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load agent skill commands:', commands);
        return [];
    }

    return commands;
}
