'use client';

import { useCallback, useState } from "react";
import { Descendant } from "slate";
import { getAllMentionElements } from "./utils";
import { toString } from "./utils";
import { useDomain } from "@/hooks/useDomain";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CreateUIMessage } from "ai";
import { createChat } from "./actions";
import { isServiceError } from "@/lib/utils";
import { createPathWithQueryParams } from "@/lib/utils";
import { SBChatMessage, SET_CHAT_STATE_QUERY_PARAM, SetChatStatePayload } from "./types";

export const useCreateNewChatThread = () => {
    const domain = useDomain();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const queryClient = useQueryClient();

    const createNewChatThread = useCallback(async (children: Descendant[], selectedRepos: string[]) => {
        const text = toString(children);
        const mentions = getAllMentionElements(children);

        const inputMessage: CreateUIMessage<SBChatMessage> = {
            role: 'user',
            parts: [
                { type: 'text', text },
            ],
            metadata: {
                mentions: mentions.map((mention) => mention.data),
            }
        };

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
                selectedRepos,
            } satisfies SetChatStatePayload)],
        );

        queryClient.invalidateQueries({
            queryKey: ['chat'],
        }).then(() => {
            router.push(url);
        });
    }, [domain, router, toast, queryClient]);

    return {
        createNewChatThread,
        isLoading,
    };
}