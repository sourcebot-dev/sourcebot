import { getRepos } from '@/actions';
import { getConfiguredLanguageModelsInfo, loadChatMessages } from '@/features/chat/actions';
import { ServiceErrorException } from '@/lib/serviceError';
import { isServiceError } from '@/lib/utils';
import { ChatThreadPanel } from './components/chatThreadPanel';

interface PageProps {
    params: {
        domain: string;
        id: string;
    };
}

export default async function Page({ params }: PageProps) {
    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos(params.domain);
    const chatMessages = await loadChatMessages({ chatId: params.id }, params.domain);

    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    if (isServiceError(chatMessages)) {
        throw new ServiceErrorException(chatMessages);
    }

   const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    return (
        <ChatThreadPanel
            chatBoxToolbarProps={{
                languageModels,
                repos: indexedRepos,
            }}
            messages={chatMessages}
            order={2}
        />
    )
}