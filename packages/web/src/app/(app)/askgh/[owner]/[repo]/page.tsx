import { addGithubRepo } from "@/features/workerApi/actions";
import { isServiceError } from "@/lib/utils";
import { ServiceError, ServiceErrorException } from "@/lib/serviceError";
import { ErrorCode } from "@/lib/errorCodes";
import { __unsafePrisma } from "@/prisma";
import { getRepoInfo } from "./api";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { RepoIndexedGuard } from "./components/repoIndexedGuard";
import { RepoNotFound } from "./components/repoNotFound";
import { LandingPage } from "./components/landingPage";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { auth } from "@/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { ChatEntitlementMessage } from "@/features/chat/components/chatEntitlementMessage";
import { env } from "@sourcebot/shared";
import { listAgentSkillCommandsOrEmpty } from "@/ee/features/chat/skills/skillCommands.server";

interface PageProps {
    params: Promise<{ owner: string; repo: string }>;
}

export default async function GitHubRepoPage(props: PageProps) {
    const params = await props.params;
    const { owner, repo } = params;
    const session = await auth();

    // The askgh experiment env flag must never bypass licensing; enforce `ask`
    // uniformly (the demo deployment carries a real license with `ask`).
    if (!await hasEntitlement('ask')) {
        return <ChatEntitlementMessage source="chat" returnPath={`/askgh/${owner}/${repo}`} />;
    }
    
    const repoIdOrError = await (async (): Promise<number | ServiceError> => {
        // 1. Look up repo by owner/repo
        const displayName = `${owner}/${repo}`;
        const existingRepo = await __unsafePrisma.repo.findFirst({
            where: {
                displayName: displayName,
                external_codeHostType: 'github',
                external_codeHostUrl: 'https://github.com',
            },
        });

        if (existingRepo) {
            return existingRepo.id;
        }

        // 2. If it doesn't exist, attempt to create it
        const response = await addGithubRepo(owner, repo);

        if (isServiceError(response)) {
            return response;
        }

        return response.repoId;
    })();

    if (isServiceError(repoIdOrError)) {
        if (repoIdOrError.errorCode === ErrorCode.REPOSITORY_NOT_FOUND) {
            return <RepoNotFound owner={owner} repo={repo} />;
        }

        throw new ServiceErrorException(repoIdOrError);
    }

    const repoId = repoIdOrError;

    const repoInfo = await getRepoInfo(repoId)
    const languageModels = await getConfiguredLanguageModelsInfo()
    const askCommands = session?.user
        ? await listAgentSkillCommandsOrEmpty()
        : [];

    if (isServiceError(repoInfo)) {
        throw new ServiceErrorException(repoInfo);
    }

    return (
        <RepoIndexedGuard initialRepoInfo={repoInfo}>
            <CustomSlateEditor>
                <LandingPage
                    languageModels={languageModels}
                    repoName={repoInfo.name}
                    repoDisplayName={repoInfo.displayName ?? undefined}
                    imageUrl={repoInfo.imageUrl ?? undefined}
                    repoId={repoInfo.id}
                    askCommands={askCommands}
                    isAuthenticated={!!session?.user}
                    maxImageBytes={env.SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES}
                />
            </CustomSlateEditor>
        </RepoIndexedGuard>
    )
}
