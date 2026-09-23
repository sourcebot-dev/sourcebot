import { env } from "@sourcebot/shared";
import type { HomeView } from "./homeView";

export function getDefaultHomeView(): HomeView {
    // Preserve the Code Search default for versions before DEFAULT_HOME_VIEW_PAGE existed.
    return env.DEFAULT_HOME_VIEW_PAGE ?? "search";
}
