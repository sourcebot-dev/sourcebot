export const HOME_VIEW_VALUES = ["search", "ask"] as const;

export type HomeView = (typeof HOME_VIEW_VALUES)[number];

export const DEFAULT_HOME_VIEW: HomeView = "search";

export function parseHomeView(value: unknown): HomeView | undefined {
    if (value === "ask" || value === "ASK") {
        return "ask";
    }

    if (value === "search" || value === "SEARCH") {
        return "search";
    }

    return undefined;
}

export function resolveHomeView({
    personalPreference,
    orgDefault,
    isAuthenticated = true,
}: {
    personalPreference?: unknown;
    orgDefault?: unknown;
    isAuthenticated?: boolean;
}): HomeView {
    return parseHomeView(isAuthenticated ? personalPreference : undefined)
        ?? parseHomeView(orgDefault)
        ?? DEFAULT_HOME_VIEW;
}
