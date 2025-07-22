import { getRepos } from "@/actions";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/actions";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { NewChatPanel } from "./components/newChatPanel";

interface PageProps {
    params: {
        domain: string;
    };
}

export default async function Page({ params }: PageProps) {
    const languageModels = await getConfiguredLanguageModelsInfo();
    const repos = await getRepos(params.domain);

    if (isServiceError(repos)) {
        throw new ServiceErrorException(repos);
    }

    const indexedRepos = repos.filter((repo) => repo.indexedAt !== undefined);

    return (
        <NewChatPanel
            chatBoxToolbarProps={{
                languageModels,
                repos: indexedRepos,
            }}
            order={2}
        />
    )
}