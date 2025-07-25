import { getRepos } from "@/actions";
import { getUserChatHistory, getConfiguredLanguageModelsInfo } from "@/features/chat/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NewChatPanel } from "./components/newChatPanel";
import { TopBar } from "../components/topBar";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatSidePanel } from "./components/chatSidePanel";
import { auth } from "@/auth";
import { AnimatedResizableHandle } from "@/components/ui/animatedResizableHandle";

interface PageProps {
    params: {
        domain: string;
    };
}

export default async function Page({ params }: PageProps) {
    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos(params.domain);
    const session = await auth();
    const chatHistory = session ? await getUserChatHistory(params.domain) : [];

    if (isServiceError(chatHistory)) {
        throw new ServiceErrorException(chatHistory);
    }

    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    return (
        <>
            <TopBar
                domain={params.domain}
            />
            <ResizablePanelGroup
                direction="horizontal"
            >
                <ChatSidePanel
                    order={1}
                    chatHistory={chatHistory}
                    isAuthenticated={!!session}
                    isCollapsedInitially={false}
                />
                <AnimatedResizableHandle />
                <NewChatPanel
                    languageModels={languageModels}
                    repos={indexedRepos}
                    order={2}
                />
            </ResizablePanelGroup>
        </>
    )
}