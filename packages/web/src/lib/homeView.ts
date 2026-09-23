export type HomeView = "search" | "ask";

export function resolveHomeView(
    cookieValue: HomeView | undefined,
    defaultHomeView: HomeView,
): HomeView {
    return cookieValue ?? defaultHomeView;
}
