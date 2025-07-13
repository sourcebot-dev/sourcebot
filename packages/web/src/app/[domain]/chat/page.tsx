'use client';

import { ResizablePanel } from '@/components/ui/resizable';
import { ChatBox } from '@/features/chat/components/chatBox';
import { ChatBoxTools } from '@/features/chat/components/chatBoxTools';
import { CustomSlateEditor } from '@/features/chat/customSlateEditor';
import { useCallback, useState } from 'react';
import { Descendant } from 'slate';
import { useCreateNewChatThread } from '@/features/chat/useCreateNewChatThread';

export default function Page() {
    const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
    const { createNewChatThread, isLoading } = useCreateNewChatThread();

    const onSubmit = useCallback((children: Descendant[]) => {
        createNewChatThread(children, selectedRepos);
    }, [createNewChatThread, selectedRepos]);


    return (
        <ResizablePanel
            order={2}
            id="chat-thread-panel"
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
                            selectedRepos={[]}
                            isRedirecting={isLoading}
                        />
                        <div className="w-full flex flex-row items-center bg-accent rounded-b-md px-2">
                            <ChatBoxTools
                                selectedRepos={selectedRepos}
                                onSelectedReposChange={setSelectedRepos}
                            />
                        </div>
                    </CustomSlateEditor>
                </div>
            </div>
        </ResizablePanel>
    )
}