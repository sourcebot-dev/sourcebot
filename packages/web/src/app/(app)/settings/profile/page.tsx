import { authenticatedPage } from "@/middleware/authenticatedPage";
import { ProfilePage } from "./profilePage";

export default authenticatedPage(async () => {
    return <ProfilePage />;
});
