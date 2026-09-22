export type HomeView = "search" | "ask";

export function resolveHomeView(
    cookieValue: string | undefined,
    defaultHomeView: HomeView,
): HomeView {
    if (cookieValue === "ask" || cookieValue === "search") {
        return cookieValue;
    }

    return defaultHomeView;
}
