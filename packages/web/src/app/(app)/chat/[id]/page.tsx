import { getRepos, getSearchContexts } from '@/actions';
import { getChatInfo, getSharedWithUsersForChat } from '@/features/chat/actions';
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { ChatThreadPanel } from '@/ee/features/chat/components/chatThreadPanel';
import { notFound } from 'next/navigation';
import { StatusCodes } from 'http-status-codes';
import { Separator } from '@/components/ui/separator';
import { ChatName } from '../components/chatName';
import { ShareChatPopover } from '../components/shareChatPopover';
import { auth } from '@/auth';
import { __unsafePrisma } from '@/prisma';
import { ChatVisibility } from '@sourcebot/db';
import { Metadata } from 'next';
import { SBChatMessage } from '@/features/chat/types';
import { getUserMessageText } from '@/features/chat/utils';
import { env } from '@sourcebot/shared';
import { hasEntitlement } from '@/lib/entitlements';
import { ChatEntitlementMessage } from '@/features/chat/components/chatEntitlementMessage';
import { captureEvent } from '@/lib/posthog';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export const generateMetadata = async ({ params }: PageProps): Promise<Metadata> => {
    const { id } = await params;

    const chat = await __unsafePrisma.chat.findUnique({
        where: {
            id,
        },
    });

    if (!chat) {
        return {
            title: 'Chat | Sourcebot',
        };
    }

    // Only show detailed metadata for public chats
    if (chat.visibility !== ChatVisibility.PUBLIC) {
        return {
            title: 'Private Chat | Sourcebot',
            description: 'Login to view',
        };
    }

    const chatName = chat.name ?? 'Untitled chat';
    const messages = chat.messages as unknown as SBChatMessage[];
    const firstUserMessage = messages.find(m => m.role === 'user');

    let description = 'A chat on Sourcebot';
    if (firstUserMessage) {
        const text = getUserMessageText(firstUserMessage);
        if (text) {
            description = text.length > 160
                ? text.substring(0, 160).trim() + '...'
                : text;
        }
    }

    return {
        title: `${chatName} | Sourcebot`,
        description,
        openGraph: {
            title: chatName,
            description,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: chatName,
            description,
        },
    };
}

export default async function Page(props: PageProps) {
    const params = await props.params;
    const session = await auth();

    // Gate the Ask experience behind the `ask` entitlement (deployment-level).
    // Viewing a public/shared chat still works on a licensed deployment; a
    // downgraded deployment shows the upsell while preserving the chat data.
    if (!await hasEntitlement('ask')) {
        return (
            <ChatEntitlementMessage
                source="chat"
                returnPath={`/chat/${params.id}`}
                title="Upgrade to view this Ask Sourcebot chat"
                description="Pick up this conversation right where you left off."
            />
        );
    }

    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos();
    const searchContexts = await getSearchContexts();
    const chatInfo = await getChatInfo({ chatId: params.id });
    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    if (isServiceError(searchContexts)) {
        throw new ServiceErrorException(searchContexts);
    }

    if (isServiceError(chatInfo)) {
        if (chatInfo.statusCode === StatusCodes.NOT_FOUND) {
            return notFound();
        }

        throw new ServiceErrorException(chatInfo);
    }

    const { messages, name, visibility, isOwner, isSharedWithUser } = chatInfo;

    // Track when a non-owner views a shared chat
    if (!isOwner) {
        captureEvent('wa_shared_chat_viewed', {
            chatId: params.id,
            visibility,
            viewerType: session ? 'authenticated' : 'anonymous',
            accessType: isSharedWithUser ? 'direct_invite' : 'public_link',
        });
    }

    const sharedWithUsers = (session && isOwner) ? await getSharedWithUsersForChat({ chatId: params.id }) : [];

    if (isServiceError(sharedWithUsers)) {
        throw new ServiceErrorException(sharedWithUsers);
    }
    

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    // Chat sharing is part of Ask (the standalone `chat-sharing` entitlement was
    // folded into `ask`). By this point the page is already gated on `ask`.
    const hasChatSharingEntitlement = await hasEntitlement('ask');

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 left-0 right-0 z-10">
                <div className="flex flex-row items-center py-1.5 px-3">
                    <div className="flex-1 flex justify-center">
                        <ChatName
                            name={name}
                            id={params.id}
                            isOwner={isOwner}
                            isAuthenticated={!!session}
                        />
                    </div>
                    <div className="shrink-0">
                        {isOwner && (
                            <ShareChatPopover
                                chatId={params.id}
                                visibility={visibility}
                                currentUser={session?.user}
                                sharedWithUsers={sharedWithUsers}
                                isChatSharingEnabledInCurrentPlan={hasChatSharingEntitlement}
                                // Disable chat sharing for the askgh experiment since we
                                // don't want to allow users to search other members.
                                isChatSharingEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'false'}
                            />
                        )}
                    </div>
                </div>
                <Separator />
            </div>
            <ChatThreadPanel
                languageModels={languageModels}
                repos={indexedRepos}
                searchContexts={searchContexts}
                messages={messages}
                isOwner={isOwner}
                isAuthenticated={!!session}
                isLoginWallEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
                maxImageBytes={env.SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES}
                chatName={name ?? undefined}
            />
        </div>
    )
}
