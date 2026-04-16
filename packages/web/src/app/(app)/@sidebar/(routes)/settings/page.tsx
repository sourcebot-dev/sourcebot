import { authenticatedPage } from "@/middleware/authenticatedPage";
import { SettingsSidebar } from "../../components/settingsSidebar";

export default authenticatedPage(async () => {
    return <SettingsSidebar />;
});
