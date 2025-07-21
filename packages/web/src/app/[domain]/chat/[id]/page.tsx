import { ChatThreadPanel } from './components/chatThreadPanel';
import { getConfiguredLanguageModelsInfo } from '@/features/chat/actions';

export default async function Page() {
    const languageModels = await getConfiguredLanguageModelsInfo();

    return (
        <ChatThreadPanel
            languageModels={languageModels}
            order={2}
        />
    )
}