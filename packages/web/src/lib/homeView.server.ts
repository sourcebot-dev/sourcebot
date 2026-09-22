import { env } from "@sourcebot/shared";
import type { HomeView } from "./homeView";

export function getDefaultHomeView(): HomeView {
    return env.EXPERIMENT_ASK_GH_ENABLED === "true" ? "ask" : "search";
}
