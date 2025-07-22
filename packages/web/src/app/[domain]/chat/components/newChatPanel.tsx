'use client';

import { ResizablePanel } from "@/components/ui/resizable";
import { ChatBox } from "@/features/chat/components/chatBox";
import { ChatBoxToolbar, ChatBoxToolbarProps } from "@/features/chat/components/chatBox/chatBoxToolbar";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { useCreateNewChatThread } from "@/features/chat/useCreateNewChatThread";
import { useCallback } from "react";
import { Descendant } from "slate";

interface NewChatPanelProps {
    chatBoxToolbarProps: ChatBoxToolbarProps;
    order: number;
}

export const NewChatPanel = ({
    chatBoxToolbarProps,
    order,
}: NewChatPanelProps) => {
    const { createNewChatThread, isLoading } = useCreateNewChatThread();

    const onSubmit = useCallback((children: Descendant[]) => {
        createNewChatThread(children);
    }, [createNewChatThread]);


    return (
        <ResizablePanel
            order={order}
            id="new-chat-panel"
            defaultSize={85}
        >
            <div className="flex flex-col h-full w-full items-center justify-start pt-[20vh]">
                <h2 className="text-4xl font-bold mb-8">What can I help you understand?</h2>
                <div className="border rounded-md w-full max-w-3xl mx-auto mb-8 shadow-sm">
                    <CustomSlateEditor>
                        <ChatBox
                            onSubmit={onSubmit}
                            className="min-h-[80px]"
                            preferredSuggestionsBoxPlacement="bottom-start"
                            isRedirecting={isLoading}
                        />
                        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                            <ChatBoxToolbar
                                {...chatBoxToolbarProps}
                            />
                        </div>
                    </CustomSlateEditor>
                </div>
            </div>
        </ResizablePanel>
    )
}