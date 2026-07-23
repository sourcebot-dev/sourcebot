import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, test } from "vitest";

import tailwindConfig from "./tailwind.config";

const compileUtilities = async (classes: string) => {
    const result = await postcss([
        tailwindcss({
            ...tailwindConfig,
            content: [{ raw: `<div class="${classes}"></div>` }],
        }),
    ]).process("@tailwind utilities;", { from: undefined });

    return result.css;
};

describe("Tailwind theme colors", () => {
    test("applies opacity modifiers to CSS variable colors", async () => {
        const css = await compileUtilities(
            "text-primary text-primary/80 bg-warning/10 border-border/30",
        );

        expect(css).toContain(
            "color: color-mix(in srgb, var(--primary) calc(var(--tw-text-opacity, 1) * 100%), transparent)",
        );
        expect(css).toContain(
            "color: color-mix(in srgb, var(--primary) calc(0.8 * 100%), transparent)",
        );
        expect(css).toContain(
            "background-color: color-mix(in srgb, var(--warning) calc(0.1 * 100%), transparent)",
        );
        expect(css).toContain(
            "border-color: color-mix(in srgb, var(--border) calc(0.3 * 100%), transparent)",
        );
    });
});
