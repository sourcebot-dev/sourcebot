import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SyncingBadge } from "./syncingBadge";

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("SyncingBadge", () => {
    test("shows a live job duration", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-31T12:00:00.000Z"));
        render(
            <SyncingBadge startedAt={Date.now() - 90_000} />,
        );

        expect(screen.getByText("Syncing")).toBeTruthy();
        expect(screen.getByText("1m 30s")).toBeTruthy();

        act(() => vi.advanceTimersByTime(1_000));

        expect(screen.getByText("1m 31s")).toBeTruthy();
    });

    test("shows pending while the indexing job is waiting to start", () => {
        render(<SyncingBadge startedAt={null} />);

        expect(screen.getByText("Pending")).toBeTruthy();
        expect(screen.queryByText("Syncing")).toBeNull();
        expect(screen.queryByText(/\d+s/)).toBeNull();
    });
});
