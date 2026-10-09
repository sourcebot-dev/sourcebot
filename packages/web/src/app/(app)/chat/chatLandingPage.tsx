import { getRepos, getSearchContexts } from "@/actions";
import { SourcebotLogo } from "@/app/components/sourcebotLogo";
import { getConfiguredLanguageModelsInfo } from "@/features/chat/utils.server";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import { ServiceErrorException } from "@/lib/serviceError";
import { isServiceError, } from "@/lib/utils";
import { LandingPageChatBox } from "./components/landingPageChatBox";
import { ChatLandingDropzone } from "./components/chatLandingDropzone";
import { env } from "@sourcebot/shared";
import { auth } from "@/auth";
import { hasEntitlement } from "@/lib/entitlements";
import { listAgentSkillCommandsOrEmpty } from "@/ee/features/chat/skills/skillCommands.server";

export async function ChatLandingPage() {
    const languageModels = await getConfiguredLanguageModelsInfo();
    const searchContexts = await getSearchContexts();
    const allRepos = await getRepos();
    const session = await auth();
    const hasAskEntitlement = await hasEntitlement('ask');
    const askCommands = session?.user && hasAskEntitlement
        ? await listAgentSkillCommandsOrEmpty()
        : [];

    if (isServiceError(allRepos)) {
        throw new ServiceErrorException(allRepos);
    }

    if (isServiceError(searchContexts)) {
        throw new ServiceErrorException(searchContexts);
    }

    return (
        <ChatLandingDropzone disabled={languageModels.length === 0}>
                <div className="flex flex-col items-center h-full overflow-y-auto pt-8 pb-8 md:pt-16 w-full px-5">
                    <div className="max-h-44 w-auto">
                        <SourcebotLogo
                            className="h-18 md:h-40 w-auto"
                        />
                    </div>
                    <CustomSlateEditor>
                        <LandingPageChatBox
                            languageModels={languageModels}
                            repos={allRepos}
                            searchContexts={searchContexts}
                            askCommands={askCommands}
                            isAuthenticated={!!session}
                            isLoginWallEnabled={env.EXPERIMENT_ASK_GH_ENABLED === 'true'}
                            maxImageBytes={env.SOURCEBOT_CHAT_ATTACHMENT_MAX_IMAGE_BYTES}
                        />
                    </CustomSlateEditor>
                </div>
        </ChatLandingDropzone>
    )
}
