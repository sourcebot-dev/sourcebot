import { describe, expect, test } from "vitest";
import {
    getAccountPermissionSyncSchedulerId,
    scheduleToMs,
} from "./schedule.js";

test("builds an account permission sync scheduler ID", () => {
    expect(getAccountPermissionSyncSchedulerId("account-1")).toBe(
        "account-permission-sync-v1-account-1",
    );
});

describe("scheduleToMs", () => {
    test.each([
        [500, 500],
        ["500ms", 500],
        ["30s", 30_000],
        ["5m", 300_000],
        ["6h", 21_600_000],
        ["1d", 86_400_000],
        [" 10m ", 600_000],
    ])("converts %s to milliseconds", (schedule, expected) => {
        expect(scheduleToMs(schedule)).toBe(expected);
    });

    test.each([
        "",
        "0s",
        "5",
        "m",
        "5x",
        "1.5h",
        "-5m",
        "5 m",
        0,
        -1,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ])('rejects invalid schedule "%s"', (schedule) => {
        expect(() => scheduleToMs(schedule)).toThrow();
    });
});
