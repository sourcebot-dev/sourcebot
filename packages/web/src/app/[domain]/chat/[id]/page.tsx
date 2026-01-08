import { getRepos, getSearchContexts } from '@/actions';
import { getUserChatHistory, getConfiguredLanguageModelsInfo, getChatInfo } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { ChatThreadPanel } from './components/chatThreadPanel';
import { notFound } from 'next/navigation';
import { StatusCodes } from 'http-status-codes';
import { TopBar } from '../../components/topBar';
import { ChatName } from '../components/chatName';
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
    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos();
    const searchContexts = await getSearchContexts(params.domain);
    const chatInfo = await getChatInfo({ chatId: params.id });
    const session = await auth();
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

    const { messages, name, visibility, isReadonly } = chatInfo;

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    return (
        <div className="flex flex-col h-screen w-screen">
            <TopBar
                domain={params.domain}
                homePath={`/${params.domain}/chat`}
            >
                <div className="flex flex-row gap-2 items-center">
                    <span className="text-muted mx-2 select-none">/</span>
                    <ChatName
                        name={name}
                        visibility={visibility}
                        id={params.id}
                        isReadonly={isReadonly}
                    />
                </div>
            </TopBar>
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
                    isChatReadonly={isReadonly}
                />
            </ResizablePanelGroup>
        </div>
    )
}