'use client';

import { useMemo } from "react";
import { SBChatMessage } from "./types";

// Pairs user messages with the assistant's response.
export const useMessagePairs = (messages: SBChatMessage[]): [SBChatMessage, SBChatMessage | undefined][] => {
    return useMemo(() => {
        const result: [SBChatMessage, SBChatMessage | undefined][] = [];
        let pendingUserMessage: SBChatMessage | null = null;

        for (const message of messages) {
            if (message.role === 'user') {
                // case: we have a orphaned user message.
                // Pair it with undefined.
                if (pendingUserMessage) {
                    result.push([pendingUserMessage, undefined]);
                }

                pendingUserMessage = message;
            } else if (message.role === 'assistant') {

                // case: we have a user <> assistant message pair.
                // Pair them.
                if (pendingUserMessage) {
                    result.push([pendingUserMessage, message]);
                    pendingUserMessage = null;
                }

                // case: we have a orphaned assistant message.
                // Ignore the orphaned assistant message.
            }
        }

        // case: the last message is a user message.
        // Pair it with undefined.
        if (pendingUserMessage) {
            result.push([pendingUserMessage, undefined]);
        }

        return result;
    }, [messages]);
};