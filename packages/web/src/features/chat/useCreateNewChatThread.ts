'use client';

import { useCallback, useState } from "react";
import { Descendant } from "slate";
import { createUIMessage, getAllMentionElements } from "./utils";
import { slateContentToString } from "./utils";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { createChat } from "./actions";
import { isServiceError } from "@/lib/utils";
import { createPathWithQueryParams } from "@/lib/utils";
import { SearchScope, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from "./types";

export const useCreateNewChatThread = () => {
    const domain = useDomain();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const createNewChatThread = useCallback(async (children: Descendant[], selectedSearchScopes: SearchScope[]) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);
        
        const inputMessage = createUIMessage(text, mentions.map((mention) => mention.data), selectedSearchScopes);

        setIsLoading(true);
        const response = await createChat(domain);
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`
            });
            setIsLoading(false);
            return;
        }

        const url = createPathWithQueryParams(`/${domain}/chat/${response.id}`,
            [SET_CHAT_STATE_QUERY_PARAM, JSON.stringify({
                inputMessage,
                selectedSearchScopes,
            } satisfies SetChatStatePayload)],
        );

        router.push(url);
        router.refresh();
    }, [domain, router, toast]);

    return {
        createNewChatThread,
        isLoading,
    };
}