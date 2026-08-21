import { CallToolRequestSchema, JSONRPCRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function isMcpActivityMessage(message: unknown): boolean {
    const messages = Array.isArray(message) ? message : [message];
    return messages.some((candidate) =>
        JSONRPCRequestSchema.safeParse(candidate).success &&
        CallToolRequestSchema.safeParse(candidate).success
    );
}
