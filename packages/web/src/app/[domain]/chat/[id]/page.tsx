import { getConfiguredModelProviderInfo } from '@/features/chat/utils';
import { ChatThreadWrapper } from './chatThreadWrapper';

export default function Page() {
    const modelProviderInfo = getConfiguredModelProviderInfo();

    return (
        <ChatThreadWrapper
            modelProviderInfo={modelProviderInfo}
        />
    )
}