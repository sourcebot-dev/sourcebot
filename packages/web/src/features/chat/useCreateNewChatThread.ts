'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { Descendant } from "slate";
import { createUIMessage, getAllMentionElements } from "./utils";
import { slateContentToString } from "./utils";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";
import { createChat, getAskGhLoginWallData } from "./actions";
import { isServiceError } from "@/lib/utils";
import { createPathWithQueryParams } from "@/lib/utils";
import { SearchScope, SetChatStatePayload } from "./types";
import { SET_CHAT_STATE_SESSION_STORAGE_KEY } from "./constants";
import { useSessionStorage } from "usehooks-ts";
import type { IdentityProviderMetadata } from "@/lib/identityProviders";
import useCaptureEvent from "@/hooks/useCaptureEvent";

const PENDING_NEW_CHAT_KEY = "askgh_pending_new_chat";

interface UseCreateNewChatThreadOptions {
    isAuthenticated?: boolean;
}

export const useCreateNewChatThread = ({ isAuthenticated = false }: UseCreateNewChatThreadOptions = {}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const [, setChatState] = useSessionStorage<SetChatStatePayload | null>(SET_CHAT_STATE_SESSION_STORAGE_KEY, null);
    const [loginWallState, setLoginWallState] = useState<{ isOpen: boolean; providers: IdentityProviderMetadata[] }>({ isOpen: false, providers: [] });
    const hasRestoredPendingMessage = useRef(false);
    const captureEvent = useCaptureEvent();

    const doCreateChat = useCallback(async (children: Descendant[], selectedSearchScopes: SearchScope[]) => {
        const text = slateContentToString(children);
        const mentions = getAllMentionElements(children);

        const inputMessage = createUIMessage(text, mentions.map((mention) => mention.data), selectedSearchScopes);

        setIsLoading(true);
        const response = await createChat({ source: 'sourcebot-web-client' });
        if (isServiceError(response)) {
            toast({
                description: `❌ Failed to create chat. Reason: ${response.message}`
            });
            setIsLoading(false);
            return;
        }

        captureEvent('wa_ask_thread_created', {
            chatId: response.id,
        });

        setChatState({
            inputMessage,
            selectedSearchScopes,
        });

        const url = createPathWithQueryParams(`/chat/${response.id}`);

        router.push(url);
    }, [router, toast, setChatState]);

    const createNewChatThread = useCallback(async (children: Descendant[], selectedSearchScopes: SearchScope[]) => {
        if (!isAuthenticated) {
            const result = await getAskGhLoginWallData();
            if (!isServiceError(result) && result.isEnabled) {
                captureEvent('wa_askgh_login_wall_prompted', {});
                sessionStorage.setItem(PENDING_NEW_CHAT_KEY, JSON.stringify({ children, selectedSearchScopes }));
                setLoginWallState({ isOpen: true, providers: result.providers });
                return;
            }
        }

        doCreateChat(children, selectedSearchScopes);
    }, [isAuthenticated, captureEvent, doCreateChat]);

    // Restore pending message after OAuth redirect
    useEffect(() => {
        if (!isAuthenticated || hasRestoredPendingMessage.current) {
            return;
        }

        const stored = sessionStorage.getItem(PENDING_NEW_CHAT_KEY);
        if (!stored) {
            return;
        }

        hasRestoredPendingMessage.current = true;
        sessionStorage.removeItem(PENDING_NEW_CHAT_KEY);

        try {
            const { children, selectedSearchScopes } = JSON.parse(stored) as {
                children: Descendant[];
                selectedSearchScopes: SearchScope[];
            };
            doCreateChat(children, selectedSearchScopes);
        } catch (error) {
            console.error('Failed to restore pending message:', error);
        }
    }, [isAuthenticated, doCreateChat]);

    return {
        createNewChatThread,
        isLoading,
        loginWall: {
            isOpen: loginWallState.isOpen,
            providers: loginWallState.providers,
            onOpenChange: (open: boolean) => setLoginWallState(prev => ({ ...prev, isOpen: open })),
        },
    };
}
