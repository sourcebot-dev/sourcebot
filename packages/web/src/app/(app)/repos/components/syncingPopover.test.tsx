import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SyncingPopover } from "./syncingPopover";

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("SyncingPopover", () => {
    test("shows a live job duration while open", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
        render(
            <SyncingPopover
                repoDisplayName="acme/sourcebot"
                startedAt={Date.now() - 90_000}
            />,
        );

        fireEvent.click(screen.getByRole("button", {
            name: "View sync details for acme/sourcebot",
        }));

        expect(screen.getByText("1m 30s")).toBeTruthy();

        act(() => vi.advanceTimersByTime(1_000));

        expect(screen.getByText("1m 31s")).toBeTruthy();
    });

    test("shows when the indexing job is waiting to start", () => {
        render(
            <SyncingPopover
                repoDisplayName="acme/sourcebot"
                startedAt={null}
            />,
        );

        fireEvent.click(screen.getByRole("button", {
            name: "View sync details for acme/sourcebot",
        }));

        expect(screen.getByText("Waiting to start")).toBeTruthy();
    });
});
