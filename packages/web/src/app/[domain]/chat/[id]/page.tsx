import { getRepos, getSearchContexts } from '@/actions';
import { getUserChatHistory, getConfiguredLanguageModelsInfo, getChatInfo, claimAnonymousChats } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { ChatThreadPanel } from './components/chatThreadPanel';
import { notFound } from 'next/navigation';
import { StatusCodes } from 'http-status-codes';
import { TopBar } from '../../components/topBar';
import { ChatName } from '../components/chatName';
import { SharePopover } from '../components/sharePopover';
import { auth } from '@/auth';
import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ChatSidePanel } from '../components/chatSidePanel';
import { ResizablePanelGroup } from '@/components/ui/resizable';

interface PageProps {
    params: Promise<{
        domain: string;
        id: string;
    }>;
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
                actions={(isOwner && session) ? <SharePopover chatId={params.id} visibility={visibility} /> : undefined}
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
