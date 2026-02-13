import { getRepos, getSearchContexts } from '@/actions';
import { getUserChatHistory, getConfiguredLanguageModelsInfo, getChatInfo, claimAnonymousChats } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { ChatThreadPanel } from './components/chatThreadPanel';
import { notFound } from 'next/navigation';
import { StatusCodes } from 'http-status-codes';
import { TopBar } from '../../components/topBar';
import { ChatName } from '../components/chatName';
import { ShareChatPopover } from '../components/shareChatPopover';
import { auth } from '@/auth';
import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ChatSidePanel } from '../components/chatSidePanel';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { prisma } from '@/prisma';
import { getOrgFromDomain } from '@/data/org';
import { ChatVisibility } from '@sourcebot/db';
import { Metadata } from 'next';
import { SBChatMessage } from '@/features/chat/types';

interface PageProps {
    params: Promise<{
        domain: string;
        id: string;
    }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { domain, id } = await params;

    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            title: 'Chat | Sourcebot',
        };
    }

    const chat = await prisma.chat.findUnique({
        where: {
            id,
            orgId: org.id,
        },
    });

    // Only show detailed metadata for public chats
    if (!chat || chat.visibility !== ChatVisibility.PUBLIC) {
        return {
            title: 'Chat | Sourcebot',
        };
    }

    const chatName = chat.name ?? 'Untitled chat';
    const messages = chat.messages as unknown as SBChatMessage[];
    const firstUserMessage = messages.find(m => m.role === 'user');

    let description = 'A chat on Sourcebot';
    if (firstUserMessage) {
        const textPart = firstUserMessage.parts.find(p => p.type === 'text');
        if (textPart && textPart.type === 'text') {
            description = textPart.text.length > 160
                ? textPart.text.substring(0, 160).trim() + '...'
                : textPart.text;
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

    // Claim any anonymous chats created by this user before they signed in.
    // This must happen before getChatInfo so the chat ownership is updated.
    if (session) {
        await claimAnonymousChats();
    }

    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos();
    const searchContexts = await getSearchContexts(params.domain);
    const chatInfo = await getChatInfo({ chatId: params.id });
    const chatHistory = session ? await getUserChatHistory() : [];

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

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

    const { messages, name, visibility, isOwner } = chatInfo;

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    return (
        <div className="flex flex-col h-screen w-screen">
            <TopBar
                domain={params.domain}
                homePath={`/${params.domain}/chat`}
                session={session}
                centerContent={
                    <ChatName
                        name={name}
                        id={params.id}
                        isOwner={isOwner}
                    />
                }
                actions={isOwner ? <ShareChatPopover chatId={params.id} visibility={visibility} isAuthenticated={!!session} /> : undefined}
            />
            <ResizablePanelGroup
                direction="horizontal"
            >
                <ChatSidePanel
                    order={1}
                    chatHistory={chatHistory}
                    isAuthenticated={!!session}
                    isCollapsedInitially={true}
                />
                <AnimatedResizableHandle />
                <ChatThreadPanel
                    languageModels={languageModels}
                    repos={indexedRepos}
                    searchContexts={searchContexts}
                    messages={messages}
                    order={2}
                    isOwner={isOwner}
                    isAuthenticated={!!session}
                    chatName={name ?? undefined}
                />
            </ResizablePanelGroup>
        </div>
    )
}
