import type { AskCommandDefinition, AskCommandSuggestion } from "./types";

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
