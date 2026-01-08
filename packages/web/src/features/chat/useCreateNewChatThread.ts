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
import { SearchScope, SET_CHAT_STATE_SESSION_STORAGE_KEY, SetChatStatePayload } from "./types";
import { useSessionStorage } from "usehooks-ts";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { SINGLE_TENANT_ORG_DOMAIN } from "@/lib/constants";

export const useCreateNewChatThread = () => {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const captureEvent = useCaptureEvent();

    const [, setChatState] = useSessionStorage<SetChatStatePayload | null>(SET_CHAT_STATE_SESSION_STORAGE_KEY, null);


    const createNewChatThread = useCallback(async (children: Descendant[], selectedSearchScopes: SearchScope[]) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);
        
        const inputMessage = createUIMessage(text, mentions.map((mention) => mention.data), selectedSearchScopes);

        setIsLoading(true);
        const response = await createChat();
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`
            });
            setIsLoading(false);
            return;
        }

        captureEvent('wa_chat_thread_created', {});

        setChatState({
            inputMessage,
            selectedSearchScopes,
        });

        const url = createPathWithQueryParams(`/${SINGLE_TENANT_ORG_DOMAIN}/chat/${response.id}`);

        router.push(url);
        router.refresh();
    }, [router, toast, setChatState, captureEvent]);

    return {
        createNewChatThread,
        isLoading,
    };
}