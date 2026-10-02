'use client';

import { useCallback, useRef, useState } from "react";
import { Descendant } from "slate";
import { createUIMessage, getAllMentionElements } from "./utils";
import { slateContentToString } from "./utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { createChat } from "./actions";
import { isServiceError } from "@/lib/utils";
import { createPathWithQueryParams } from "@/lib/utils";
import { AttachmentData, SearchScope, SetChatStatePayload, Source } from "./types";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY, SET_CHAT_STATE_SESSION_STORAGE_KEY } from "./constants";
import { useSessionStorage } from "usehooks-ts";

const getStoredDisabledMcpServerIds = (): string[] => {
    try {
        const stored = window.localStorage.getItem(DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored) as string[];
        }
    } catch { /* fall through to [] */ }

    return [];
}

export const useCreateNewChatThread = () => {
    const [isLoading, setIsLoading] = useState(false);
    const createInFlightRef = useRef(false);
    const { toast } = useToast();
    const router = useRouter();
    const [, setChatState] = useSessionStorage<SetChatStatePayload | null>(SET_CHAT_STATE_SESSION_STORAGE_KEY, null);

    const createNewChatThread = useCallback(async (children: Descendant[], overrideSearchScopes?: SearchScope[], overrideDisabledMcpServerIds?: string[], attachments: AttachmentData[] = []) => {
        if (createInFlightRef.current) {
            return;
        }
        createInFlightRef.current = true;

        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        let storedScopes: SearchScope[] = [];
        try {
            const stored = window.localStorage.getItem(SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY);
            if (stored) {
                storedScopes = JSON.parse(stored) as SearchScope[];
            }
        } catch { /* fall through to [] */ }

        const selectedSearchScopes = overrideSearchScopes ?? storedScopes;
        const disabledMcpServerIds = overrideDisabledMcpServerIds ?? getStoredDisabledMcpServerIds();
        const inputMessage = createUIMessage(text, mentions.map((mention) => mention.data), selectedSearchScopes, disabledMcpServerIds, attachments);

        setIsLoading(true);
        const response = await createChat({ source: 'sourcebot-web-client' });
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`
            });
            setIsLoading(false);
            createInFlightRef.current = false;
            return;
        }

        setChatState({
            inputMessage,
            selectedSearchScopes,
            disabledMcpServerIds,
        });

        const url = createPathWithQueryParams(`/chat/${response.id}`);

        router.push(url);
    }, [router, toast, setChatState]);

    const createChatFromSource = useCallback(async (source: Source) => {
        if (createInFlightRef.current) {
            return;
        }
        createInFlightRef.current = true;

        const disabledMcpServerIds = getStoredDisabledMcpServerIds();
        const inputMessage = createUIMessage(
            'Explain this selected code.',
            [],
            [],
            disabledMcpServerIds,
            [],
            [source],
        );

        setIsLoading(true);
        const response = await createChat({ source: 'sourcebot-web-client' });
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`,
            });
            setIsLoading(false);
            createInFlightRef.current = false;
            return;
        }

        setChatState({
            inputMessage,
            selectedSearchScopes: [],
            disabledMcpServerIds,
        });

        router.push(`/chat/${response.id}`);
    }, [router, setChatState, toast]);

    return {
        createNewChatThread,
        createChatFromSource,
        isLoading,
    };
}
