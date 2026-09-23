import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        DEFAULT_HOME_VIEW_PAGE: undefined as string | undefined,
    },
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
}));

import { getDefaultHomeView } from "./homeView.server";

describe("getDefaultHomeView", () => {
    beforeEach(() => {
        mocks.env.DEFAULT_HOME_VIEW_PAGE = undefined;
    });

    test("defaults to Search when DEFAULT_HOME_VIEW_PAGE is unset", () => {
        expect(getDefaultHomeView()).toBe("search");
    });

    test("returns Ask when DEFAULT_HOME_VIEW_PAGE is ask", () => {
        mocks.env.DEFAULT_HOME_VIEW_PAGE = "ask";

        expect(getDefaultHomeView()).toBe("ask");
    });

    test("falls back to Search for an unsupported value", () => {
        mocks.env.DEFAULT_HOME_VIEW_PAGE = "unsupported";

        expect(getDefaultHomeView()).toBe("search");
    });
});
