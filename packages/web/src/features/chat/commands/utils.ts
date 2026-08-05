import type { AskCommandDefinition, AskCommandSuggestion, CommandInvocationData, CommandMentionData } from "./types";

export const toAskCommandSuggestion = (command: AskCommandDefinition): AskCommandSuggestion => ({
    ...command,
    type: 'command',
});

export const filterAskCommandDefinitions = (
    commands: AskCommandDefinition[],
    query: string,
): AskCommandDefinition[] => {
    const normalizedQuery = query.trim().replace(/^\//, '').toLowerCase();

    return commands.filter((command) => {
        if (command.isHidden) {
            return false;
        }

        if (normalizedQuery.length === 0) {
            return true;
        }

        const searchableFields = [
            command.slug,
            command.name,
            command.description,
            ...(command.aliases ?? []),
        ];

        return searchableFields.some((field) => field.toLowerCase().includes(normalizedQuery));
    });
};

const findCommandPrefixIndex = (text: string, slug: string): number => {
    const commandPrefix = `/${slug}`;
    let searchFrom = 0;

    while (searchFrom < text.length) {
        const index = text.indexOf(commandPrefix, searchFrom);
        if (index === -1) {
            return -1;
        }

        const beforeCommand = index === 0 ? "" : text[index - 1];
        const afterCommand = text[index + commandPrefix.length] ?? "";
        if ((!beforeCommand || /\s/.test(beforeCommand)) && (!afterCommand || /\s/.test(afterCommand))) {
            return index;
        }

        searchFrom = index + commandPrefix.length;
    }

    return -1;
};

export const createCommandInvocationData = (
    text: string,
    commandMentions: CommandMentionData[],
): CommandInvocationData | undefined => {
    const command = commandMentions[0];
    if (!command) {
        return undefined;
    }

    const commandIndex = findCommandPrefixIndex(text, command.slug);
    if (commandIndex === -1) {
        return undefined;
    }

    return {
        type: command.type,
        commandId: command.commandId,
        sourceId: command.sourceId,
        slug: command.slug,
        name: command.name,
        ...(command.sourceLabel ? { sourceLabel: command.sourceLabel } : {}),
    };
};
