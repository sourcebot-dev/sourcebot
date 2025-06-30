'use client';

import { useParams } from "next/navigation";

export const useChatId = (): string | undefined => {
    const { id: chatId } = useParams<{ id: string }>();
    return chatId;
}