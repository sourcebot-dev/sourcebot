'use client';

import { Button } from "@/components/ui/button";
import {
    BookOpen,
    CircleAlert,
    Database,
    FlaskConical,
    ListTodo,
    Logs,
    Package,
    Search,
    Settings,
    Variable,
    type LucideIcon,
} from "lucide-react";
import { Editor, Transforms } from "slate";
import { ReactEditor, useSlate } from "slate-react";
import type { ExampleQuestion, ExampleQuestionIcon } from "./exampleQuestions";

const icons: Record<ExampleQuestionIcon, LucideIcon> = {
    book: BookOpen,
    database: Database,
    error: CircleAlert,
    flask: FlaskConical,
    list: ListTodo,
    logs: Logs,
    package: Package,
    search: Search,
    settings: Settings,
    variable: Variable,
};

interface ExampleQuestionBadgesProps {
    questions: readonly ExampleQuestion[];
    disabled?: boolean;
}

export function ExampleQuestionBadges({
    questions,
    disabled = false,
}: ExampleQuestionBadgesProps) {
    const editor = useSlate();

    const insertQuestion = (question: string) => {
        Transforms.select(editor, Editor.range(editor, []));
        Transforms.insertText(editor, question);
        ReactEditor.focus(editor);
    };

    return (
        <div className="mt-4 flex w-full max-w-[800px] flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">
                Ask questions about:
            </span>
            {questions.map(({ label, question, icon }) => {
                const Icon = icons[icon];
                return (
                    <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full px-2.5 text-xs font-normal"
                        onClick={() => insertQuestion(question)}
                        disabled={disabled}
                        aria-label={`Ask about ${label.toLowerCase()}`}
                    >
                        <Icon className="text-muted-foreground" />
                        {label}
                    </Button>
                );
            })}
        </div>
    );
}
