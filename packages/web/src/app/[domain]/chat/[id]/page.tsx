import { getConfiguredModelProviderInfo } from '@/features/chat/utils';
import { ChatThreadPanel } from './components/chatThreadPanel';

export default function Page() {
    const modelProviderInfo = getConfiguredModelProviderInfo();

    return (
        <ChatThreadPanel
            modelProviderInfo={modelProviderInfo}
            order={2}
        />
    )
}