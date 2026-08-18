import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { Node } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CustomSlateEditor } from "@/features/chat/customSlateEditor";
import type { CustomEditor } from "@/features/chat/types";
import { ExampleQuestionBadges } from "./exampleQuestionBadges";
import type { ExampleQuestion } from "./exampleQuestions";

const questions = [
    {
        label: "Entry points",
        question: "Find the main entry points across the indexed repositories.",
        icon: "search",
    },
    {
        label: "Configuration",
        question: "Where is configuration defined and loaded?",
        icon: "settings",
    },
    {
        label: "Testing",
        question: "Find examples of how this code is tested.",
        icon: "flask",
    },
] as const satisfies readonly ExampleQuestion[];

const EditorValue = ({
    onEditor,
}: {
    onEditor: (editor: CustomEditor) => void;
}) => {
    const editor = useSlate();

    useEffect(() => {
        onEditor(editor);
    }, [editor, onEditor]);

    return null;
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("ExampleQuestionBadges", () => {
    test("inserts the selected question and replaces the previous prompt", () => {
        vi.spyOn(ReactEditor, "focus").mockImplementation(() => undefined);
        const onEditor = vi.fn<(editor: CustomEditor) => void>();
        render(
            <CustomSlateEditor>
                <ExampleQuestionBadges questions={questions} />
                <EditorValue onEditor={onEditor} />
            </CustomSlateEditor>,
        );
        const editor = onEditor.mock.calls[0]?.[0];
        expect(editor).toBeDefined();

        expect(screen.getByText("Ask questions about:")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask about entry points" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask about configuration" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ask about testing" })).toBeTruthy();

        fireEvent.click(screen.getByRole("button", {
            name: "Ask about entry points",
        }));
        expect(Node.string(editor!)).toBe(
            "Find the main entry points across the indexed repositories.",
        );

        fireEvent.click(screen.getByRole("button", {
            name: "Ask about testing",
        }));
        expect(Node.string(editor!)).toBe("Find examples of how this code is tested.");
    });
});
