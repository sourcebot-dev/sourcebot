import { getChatPreferences } from "@/features/chat/actions";
import { authenticatedPage } from "@/middleware/authenticatedPage";
import { isServiceError } from "@/lib/utils";
import { ServiceErrorException } from "@/lib/serviceError";
import { ChatPreferencesPage } from "./chatPreferencesPage";

export default authenticatedPage(async () => {
    const result = await getChatPreferences();
    if (isServiceError(result)) {
        throw new ServiceErrorException(result);
    }

    return (
        <ChatPreferencesPage
            initialPreferences={result.preferences}
            initialCustomInstructions={result.customInstructions}
        />
    );
});
