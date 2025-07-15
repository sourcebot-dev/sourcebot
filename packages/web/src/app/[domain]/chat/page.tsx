import { getConfiguredModelProviderInfo } from "@/features/chat/utils";
import { NewChatPanel } from "./components/newChatPanel";

export default function Page() {

    const modelProviderInfo = getConfiguredModelProviderInfo();

    return (
        <NewChatPanel
            modelProviderInfo={modelProviderInfo}
        />
    )
}