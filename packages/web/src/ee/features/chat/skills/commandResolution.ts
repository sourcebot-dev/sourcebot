import { substituteArguments } from "@/features/chat/commands/argumentSubstitution";
import { captureEvent } from "@/lib/posthog";
import { ASK_COMMAND_SOURCE_ORG_SKILL, ASK_COMMAND_SOURCE_PERSONAL_SKILL, commandInvocationDataSchema, type CommandInvocationData } from "@/features/chat/commands/types";
import { FILE_REFERENCE_REGEX } from "@/features/chat/constants";
import type { FileSource, SBChatMessage, SBChatMessagePart } from "@/features/chat/types";
import { orgAgentSkillVisibleToUserWhere, personalAgentSkillAuthScope, type PrismaClient } from "@sourcebot/db";

const getTextPartContent = (message: SBChatMessage) =>
    message.parts.find((part) => part.type === "text")?.text ?? "";

type CommandMessagePart = Extract<SBChatMessagePart, { type: "data-command" }>;

const getCommandPart = (message: SBChatMessage): CommandMessagePart | undefined =>
    message.parts.find((part): part is CommandMessagePart => part.type === "data-command");

const getCommandInvocation = (message: SBChatMessage) => {
    const commandPart = getCommandPart(message);
    if (!commandPart) {
        return undefined;
    }

    const parsedCommand = commandInvocationDataSchema.safeParse(commandPart.data);
    if (!parsedCommand.success) {
        return undefined;
    }

    return {
        commandPart,
        command: parsedCommand.data,
        fallbackText: getTextPartContent(message),
    };
};

const getMaterializedCommandText = ({
    command,
    fallbackText,
}: {
    command: CommandInvocationData;
    fallbackText: string;
}): string => command.expandedText ?? fallbackText;

const withExpandedCommandText = (
    message: SBChatMessage,
    commandPart: CommandMessagePart,
    command: CommandInvocationData,
    expandedText: string,
): SBChatMessage => ({
    ...message,
    parts: message.parts.map((part) => {
        if (part !== commandPart) {
            return part;
        }

        return {
            ...part,
            data: {
                ...command,
                expandedText,
            },
        };
    }),
});

type ResolvableCommandMessage = {
    index: number;
    message: SBChatMessage;
    commandPart: CommandMessagePart;
    command: CommandInvocationData;
    fallbackText: string;
};

const commandLookupKey = (sourceId: string, commandId: string) => `${sourceId}:${commandId}`;

const getCommandIdsForSource = (
    resolvableCommands: ResolvableCommandMessage[],
    sourceId: string,
) => Array.from(new Set(
    resolvableCommands
        .filter(({ command }) => command.sourceId === sourceId)
        .map(({ command }) => command.commandId)
));

const DEFAULT_SKILL_FILE_REFERENCE_REVISION = "HEAD";

const getFileSourceKey = (source: Pick<FileSource, "repo" | "path" | "revision">) =>
    `${source.repo}\0${source.path}\0${source.revision}`;

export const getFileSourcesFromText = (text: string): FileSource[] => {
    const sources: FileSource[] = [];
    const seen = new Set<string>();

    FILE_REFERENCE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FILE_REFERENCE_REGEX.exec(text)) !== null) {
        const [, repo, path] = match;
        if (!repo || !path) {
            continue;
        }

        const source: FileSource = {
            type: "file",
            repo,
            path,
            name: path.split("/").pop() || path,
            revision: DEFAULT_SKILL_FILE_REFERENCE_REVISION,
        };
        const key = getFileSourceKey(source);
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        sources.push(source);
    }
    FILE_REFERENCE_REGEX.lastIndex = 0;

    return sources;
};

type DataSourceMessagePart = Extract<SBChatMessagePart, { type: "data-source" }>;

const isDataSourceMessagePart = (part: SBChatMessagePart): part is DataSourceMessagePart =>
    part.type === "data-source";

const withFileSourcesFromMaterializedCommandText = (
    message: SBChatMessage,
    expandedText: string,
): SBChatMessage => {
    const fileSources = getFileSourcesFromText(expandedText);
    if (fileSources.length === 0) {
        return message;
    }

    const existingSourceKeys = new Set(
        message.parts
            .filter(isDataSourceMessagePart)
            .map((part) => getFileSourceKey(part.data)),
    );
    const newSourceParts = fileSources
        .filter((source) => !existingSourceKeys.has(getFileSourceKey(source)))
        .map((source): DataSourceMessagePart => ({
            type: "data-source",
            data: source,
        }));

    if (newSourceParts.length === 0) {
        return message;
    }

    return {
        ...message,
        parts: [...message.parts, ...newSourceParts],
    };
};

const withFileSourcesFromExistingMaterializedCommand = (message: SBChatMessage): SBChatMessage => {
    const invocation = getCommandInvocation(message);
    if (!invocation || invocation.command.expandedText === undefined) {
        return message;
    }

    return withFileSourcesFromMaterializedCommandText(message, invocation.command.expandedText);
};

export const materializeCommandMessageText = async ({
    message,
    prisma,
    userId,
    orgId,
}: {
    message: SBChatMessage;
    prisma: PrismaClient;
    userId?: string;
    orgId?: number;
}): Promise<SBChatMessage> => {
    const [materializedMessage] = await materializeCommandMessageTexts({
        messages: [message],
        prisma,
        userId,
        orgId,
    });

    return materializedMessage;
};

export const materializeCommandMessageTexts = async ({
    messages,
    prisma,
    userId,
    orgId,
}: {
    messages: SBChatMessage[];
    prisma: PrismaClient;
    userId?: string;
    orgId?: number;
}): Promise<SBChatMessage[]> => {
    const resolvableCommands = messages
        .map((message, index): ResolvableCommandMessage | undefined => {
            if (message.role !== "user") {
                return undefined;
            }

            const invocation = getCommandInvocation(message);
            if (!invocation || invocation.command.expandedText !== undefined) {
                return undefined;
            }

            return {
                index,
                message,
                ...invocation,
            };
        })
        .filter((message) => message !== undefined);

    if (resolvableCommands.length === 0) {
        return messages.map(withFileSourcesFromExistingMaterializedCommand);
    }

    const personalScope = userId ? personalAgentSkillAuthScope(userId) : undefined;
    const orgVisibleWhere = userId !== undefined && orgId !== undefined
        ? orgAgentSkillVisibleToUserWhere(userId, orgId)
        : undefined;
    const personalSkillCommandIds = getCommandIdsForSource(resolvableCommands, ASK_COMMAND_SOURCE_PERSONAL_SKILL);
    const orgSkillCommandIds = getCommandIdsForSource(resolvableCommands, ASK_COMMAND_SOURCE_ORG_SKILL);

    const [personalSkills, orgSkills] = await Promise.all([
        personalScope && personalSkillCommandIds.length > 0
            ? prisma.agentSkill.findMany({
                where: {
                    id: { in: personalSkillCommandIds },
                    ...personalScope,
                    enabled: true,
                },
                select: {
                    id: true,
                    instructions: true,
                    argumentNames: true,
                },
            })
            : [],
        orgVisibleWhere && orgSkillCommandIds.length > 0
            ? prisma.agentSkill.findMany({
                where: {
                    id: { in: orgSkillCommandIds },
                    ...orgVisibleWhere,
                },
                select: {
                    id: true,
                    instructions: true,
                    argumentNames: true,
                },
            })
            : [],
    ]);

    const skillById = new Map([
        ...personalSkills.map((skill) => [
            commandLookupKey(ASK_COMMAND_SOURCE_PERSONAL_SKILL, skill.id),
            skill,
        ] as const),
        ...orgSkills.map((skill) => [
            commandLookupKey(ASK_COMMAND_SOURCE_ORG_SKILL, skill.id),
            skill,
        ] as const),
    ]);

    const materializedMessages = [...messages];
    for (const { index, message, commandPart, command, fallbackText } of resolvableCommands) {
        const skill = skillById.get(commandLookupKey(command.sourceId, command.commandId));
        const expandedText = skill
            ? substituteArguments(skill.instructions, command.rawArguments, skill.argumentNames)
            : fallbackText;
        materializedMessages[index] = withExpandedCommandText(message, commandPart, command, expandedText);

        // Symmetric observability with auto-invocation (load_skill). Only fires
        // for newly-materialized commands — already-expanded ones are filtered
        // out above — so it counts each manual invocation exactly once.
        if (skill) {
            void captureEvent('ask_skill_invoked', {
                source: 'sourcebot-ask-agent',
                activationMethod: 'manual',
                skillId: command.commandId,
                slug: command.slug,
                name: command.name,
                sourceLabel: command.sourceLabel,
                success: true,
            });
        }
    }

    return materializedMessages.map(withFileSourcesFromExistingMaterializedCommand);
};

export const getUserMessageModelText = (message: SBChatMessage): string => {
    const fallbackText = getTextPartContent(message);
    const invocation = getCommandInvocation(message);
    if (!invocation) {
        return fallbackText;
    }

    return getMaterializedCommandText(invocation);
};
