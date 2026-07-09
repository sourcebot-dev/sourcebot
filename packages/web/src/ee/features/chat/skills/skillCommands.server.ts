import 'server-only';

import type { AskCommandDefinition } from "@/features/chat/commands/types";
import { isServiceError } from "@/lib/utils";
import { listAgentSkillCommands, listSharedAgentSkillCommands, listPersonalAgentSkillCommands } from "./actions";

export const listPersonalAgentSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listPersonalAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load personal agent skill commands:', commands);
        return [];
    }

    return commands;
}

export const listSharedSkillCommandsOrEmpty = async (): Promise<AskCommandDefinition[]> => {
    const commands = await listSharedAgentSkillCommands();
    if (isServiceError(commands)) {
        console.error('Failed to load shared agent skill commands:', commands);
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
