import { substituteArguments } from "@/features/chat/commands/argumentSubstitution";
import { ASK_COMMAND_SOURCE_PERSONAL_SKILL, commandInvocationDataSchema, type CommandInvocationData } from "@/features/chat/commands/types";
import type { SBChatMessage, SBChatMessagePart } from "@/features/chat/types";
import { getAgentSkillNamespaceKey, type PrismaClient } from "@sourcebot/db";

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

export const materializeCommandMessageText = async ({
    message,
    prisma,
    userId,
}: {
    message: SBChatMessage;
    prisma: PrismaClient;
    userId?: string;
}): Promise<SBChatMessage> => {
    const [materializedMessage] = await materializeCommandMessageTexts({
        messages: [message],
        prisma,
        userId,
    });

    return materializedMessage;
};

export const materializeCommandMessageTexts = async ({
    messages,
    prisma,
    userId,
}: {
    messages: SBChatMessage[];
    prisma: PrismaClient;
    userId?: string;
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
        return messages;
    }

    const namespaceKey = userId ? getAgentSkillNamespaceKey({ scope: "PERSONAL", userId }) : undefined;
    const personalSkillCommandIds = Array.from(new Set(
        resolvableCommands
            .filter(({ command }) => command.sourceId === ASK_COMMAND_SOURCE_PERSONAL_SKILL)
            .map(({ command }) => command.commandId)
    ));
    const skills = namespaceKey && personalSkillCommandIds.length > 0
        ? await prisma.agentSkill.findMany({
            where: {
                id: { in: personalSkillCommandIds },
                namespaceKey,
                enabled: true,
            },
            select: {
                id: true,
                instructions: true,
                argumentNames: true,
            },
        })
        : [];
    const skillById = new Map(skills.map((skill) => [skill.id, skill]));

    const materializedMessages = [...messages];
    for (const { index, message, commandPart, command, fallbackText } of resolvableCommands) {
        const skill = skillById.get(command.commandId);
        const expandedText = skill
            ? substituteArguments(skill.instructions, command.rawArguments, skill.argumentNames)
            : fallbackText;
        materializedMessages[index] = withExpandedCommandText(message, commandPart, command, expandedText);
    }

    return materializedMessages;
};

export const getUserMessageModelText = (message: SBChatMessage): string => {
    const fallbackText = getTextPartContent(message);
    const invocation = getCommandInvocation(message);
    if (!invocation) {
        return fallbackText;
    }

    return getMaterializedCommandText(invocation);
};
