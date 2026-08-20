import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RepositorySyncIssuesBanner } from "./repositorySyncIssuesBanner";

vi.mock("./bannerShell", () => ({
    BannerShell: ({
        icon,
        title,
        description,
        action,
    }: {
        icon?: ReactNode;
        title: ReactNode;
        description?: ReactNode;
        action?: ReactNode;
    }) => (
        <div>
            {icon}
            <div>{title}</div>
            <div>{description}</div>
            <div>{action}</div>
        </div>
    ),
}));

afterEach(cleanup);

describe("RepositorySyncIssuesBanner", () => {
    test("summarizes failures and warnings with links to both filters", () => {
        render(
            <RepositorySyncIssuesBanner
                id="repositorySyncFailed"
                dismissible={true}
                role={null}
                now={new Date("2026-08-17T12:00:00Z")}
                failedCount={1}
                warningCount={2}
            />,
        );

        expect(screen.getByText("3 repositories need attention")).toBeTruthy();
        expect(screen.getByText(
            "1 repository failed to sync and is unavailable. 2 repositories have warnings and may contain stale results.",
        )).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "View failed" }).getAttribute("href"),
        ).toBe("/repos?status=failed");
        expect(
            screen.getByRole("link", { name: "View warnings" }).getAttribute("href"),
        ).toBe("/repos?status=warning");
    });

    test("uses singular copy and only renders the relevant action", () => {
        render(
            <RepositorySyncIssuesBanner
                id="repositorySyncWarning"
                dismissible={true}
                role={null}
                now={new Date("2026-08-17T12:00:00Z")}
                failedCount={0}
                warningCount={1}
            />,
        );

        expect(screen.getByText("1 repository needs attention")).toBeTruthy();
        expect(screen.getByText(
            "1 repository has a warning and may contain stale results.",
        )).toBeTruthy();
        expect(screen.queryByRole("link", { name: "View failed" })).toBeNull();
        expect(screen.getByRole("link", { name: "View warnings" })).toBeTruthy();
    });
});
