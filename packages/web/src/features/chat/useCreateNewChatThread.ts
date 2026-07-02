'use client';

import { useCallback, useState } from "react";
import { Descendant } from "slate";
import { createUIMessage, getAllMentionElements } from "./utils";
import { slateContentToString } from "./utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { createChat } from "./actions";
import { isServiceError } from "@/lib/utils";
import { createPathWithQueryParams } from "@/lib/utils";
import { AttachmentData, SearchScope, SetChatStatePayload } from "./types";
import { DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY, SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY, SET_CHAT_STATE_SESSION_STORAGE_KEY } from "./constants";
import { useSessionStorage } from "usehooks-ts";

export const useCreateNewChatThread = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const [, setChatState] = useSessionStorage<SetChatStatePayload | null>(SET_CHAT_STATE_SESSION_STORAGE_KEY, null);

    const createNewChatThread = useCallback(async (children: Descendant[], overrideSearchScopes?: SearchScope[], overrideDisabledMcpServerIds?: string[], attachments: AttachmentData[] = []) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        let storedScopes: SearchScope[] = [];
        try {
            const stored = window.localStorage.getItem(SELECTED_SEARCH_SCOPES_LOCAL_STORAGE_KEY);
            if (stored) {
                storedScopes = JSON.parse(stored) as SearchScope[];
            }
        } catch { /* fall through to [] */ }

        let storedDisabledMcpServerIds: string[] = [];
        try {
            const stored = window.localStorage.getItem(DISABLED_MCP_SERVER_IDS_LOCAL_STORAGE_KEY);
            if (stored) {
                storedDisabledMcpServerIds = JSON.parse(stored) as string[];
            }
        } catch { /* fall through to [] */ }

        const selectedSearchScopes = overrideSearchScopes ?? storedScopes;
        const disabledMcpServerIds = overrideDisabledMcpServerIds ?? storedDisabledMcpServerIds;
        const inputMessage = createUIMessage(text, mentions.map((mention) => mention.data), selectedSearchScopes, disabledMcpServerIds, attachments);

        setIsLoading(true);
        const response = await createChat({ source: 'sourcebot-web-client' });
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`
            });
            setIsLoading(false);
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

    return {
        createNewChatThread,
        isLoading,
    };
}
