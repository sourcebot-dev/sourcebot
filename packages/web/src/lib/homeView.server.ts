import { env } from "@sourcebot/shared";
import type { HomeView } from "./homeView";

export function getDefaultHomeView(): HomeView {
    return env.DEFAULT_HOME_VIEW_PAGE === "ask" ? "ask" : "search";
}
