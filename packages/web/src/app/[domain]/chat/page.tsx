import { NewChatPanel } from "./components/newChatPanel";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/actions";

export default async function Page() {

    const languageModels = await getConfiguredLanguageModelsInfo();

    return (
        <NewChatPanel
            languageModels={languageModels}
        />
    )
}