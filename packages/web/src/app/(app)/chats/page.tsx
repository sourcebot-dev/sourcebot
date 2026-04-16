import { authenticatedPage } from "@/middleware/authenticatedPage";
import { ChatsPage } from "./chatsPage";

export default authenticatedPage(async () => {
    return <ChatsPage />;
});
