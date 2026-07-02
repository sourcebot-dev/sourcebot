'use client';

import { ChatBoxHandle } from "@/features/chat/components/chatBox";
import { ChatPaneDropzone } from "@/features/chat/components/chatBox/chatPaneDropzone";
import { createContext, ReactNode, useCallback, useContext, useRef } from "react";

type RegisterChatBoxHandle = (handle: ChatBoxHandle | null) => void;

const LandingChatBoxContext = createContext<RegisterChatBoxHandle | null>(null);

// Lets the (nested) landing chat box register its imperative handle so the
// pane-level drop zone can forward dropped files into it. Returns a no-op when
// rendered outside the provider.
export const useRegisterLandingChatBox = (): RegisterChatBoxHandle => {
    return useContext(LandingChatBoxContext) ?? (() => { });
}

interface ChatLandingDropzoneProps {
    disabled?: boolean;
    children: ReactNode;
}

// Wraps the entire unstarted-chat landing pane in a drag-and-drop target.
// The chat box lives deeper in the tree (and behind a server/client boundary),
// so it registers its handle via context rather than a direct ref.
export const ChatLandingDropzone = ({ disabled, children }: ChatLandingDropzoneProps) => {
    const handleRef = useRef<ChatBoxHandle | null>(null);

    const register = useCallback<RegisterChatBoxHandle>((handle) => {
        handleRef.current = handle;
    }, []);

    return (
        <LandingChatBoxContext.Provider value={register}>
            <ChatPaneDropzone
                className="flex flex-col items-center h-full overflow-hidden"
                onFilesDropped={(files) => handleRef.current?.addFiles(files)}
                disabled={disabled}
            >
                {children}
            </ChatPaneDropzone>
        </LandingChatBoxContext.Provider>
    )
}
