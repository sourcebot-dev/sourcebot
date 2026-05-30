import { authenticatedPage } from "@/middleware/authenticatedPage";
import { ChatsPage } from "./chatsPage";
import { hasEntitlement } from "@/lib/entitlements";
import { ChatEntitlementMessage } from "@/features/chat/components/chatEntitlementMessage";

export default authenticatedPage(async () => {
    if (!await hasEntitlement('ask')) {
        return (
            <ChatEntitlementMessage
                source="chats"
                returnPath="/chats"
                title="Upgrade to view Ask Sourcebot history"
                description="Your Ask Sourcebot history will be stored until you upgrade"
            />
        );
    }
    return <ChatsPage />;
});
``