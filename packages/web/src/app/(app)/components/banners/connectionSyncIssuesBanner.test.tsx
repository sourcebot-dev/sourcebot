import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConnectionSyncIssuesBanner } from "./connectionSyncIssuesBanner";

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

describe("ConnectionSyncIssuesBanner", () => {
    test("renders a never-synced failure independently", () => {
        render(
            <ConnectionSyncIssuesBanner
                id="connectionSyncFailed"
                dismissible={true}
                role={null}
                now={new Date("2026-08-18T12:00:00Z")}
                count={1}
                status="failed"
            />,
        );

        expect(screen.getByText("1 code host connection needs attention")).toBeTruthy();
        expect(screen.getByText(
            "This connection failed to sync. Repositories are unavailable.",
        )).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "View failed" }).getAttribute("href"),
        ).toBe("/settings/connections?status=failed");
        expect(screen.queryByRole("link", { name: "View warnings" })).toBeNull();
    });

    test("renders warnings independently", () => {
        render(
            <ConnectionSyncIssuesBanner
                id="connectionSyncWarning"
                dismissible={true}
                role={null}
                now={new Date("2026-08-18T12:00:00Z")}
                count={2}
                status="warning"
            />,
        );

        expect(screen.getByText("2 code host connections need attention")).toBeTruthy();
        expect(screen.getByText(
            "These connections have warnings. Repository discovery may be incomplete or out of date.",
        )).toBeTruthy();
        expect(
            screen.getByRole("link", { name: "View warnings" }).getAttribute("href"),
        ).toBe("/settings/connections?status=warning");
        expect(screen.queryByRole("link", { name: "View failed" })).toBeNull();
    });
});
