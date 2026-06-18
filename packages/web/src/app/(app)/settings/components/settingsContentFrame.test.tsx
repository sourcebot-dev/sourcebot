import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SettingsContentFrame } from "./settingsContentFrame";

const navigationMock = vi.hoisted(() => ({
    pathname: "/settings/general",
}));

vi.mock("next/navigation", () => ({
    usePathname: () => navigationMock.pathname,
}));

describe("SettingsContentFrame", () => {
    test.each([
        "/settings/accountAskAgent/skills/new",
        "/settings/accountAskAgent/skills/skill-1",
        "/settings/accountAskAgent/workspaceSkills/skill-1",
    ])("renders %s edge-to-edge", (pathname) => {
        navigationMock.pathname = pathname;

        const { container } = render(
            <SettingsContentFrame>
                <div>Editor</div>
            </SettingsContentFrame>,
        );

        expect(container.querySelector("main")).toBeNull();
        expect(container.firstElementChild?.className).toBe("h-full");
    });

    test("renders ordinary settings pages in the centered frame", () => {
        navigationMock.pathname = "/settings/general";

        const { container } = render(
            <SettingsContentFrame>
                <div>General</div>
            </SettingsContentFrame>,
        );

        expect(container.querySelector("main")).not.toBeNull();
    });
});
