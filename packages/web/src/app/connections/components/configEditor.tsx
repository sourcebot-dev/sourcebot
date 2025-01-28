'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
    handleRefresh,
    jsonCompletion,
    jsonSchemaHover,
    jsonSchemaLinter,
    stateExtensions
} from "codemirror-json-schema";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Schema } from "ajv";

export type QuickActionFn<T> = (previous: T) => T;

interface ConfigEditorProps<T> {
    value: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (...event: any[]) => void;
    actions: {
        name: string;
        fn: QuickActionFn<T>;
    }[],
    schema: Schema;
}

const customAutocompleteStyle = EditorView.baseTheme({
    ".cm-tooltip.cm-completionInfo": {
        padding: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
    },
    ".cm-tooltip-hover.cm-tooltip": {
        padding: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
    }
});


export function ConfigEditor<T>({
    value,
    onChange,
    actions,
    schema,
}: ConfigEditorProps<T>) {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();

    const isQuickActionsDisabled = useMemo(() => {
        try {
            JSON.parse(value);
            return false;
        } catch {
            return true;
        }
    }, [value]);

    const onQuickAction = (action: QuickActionFn<T>) => {
        let previousConfig: T;
        try {
            previousConfig = JSON.parse(value) as T;
        } catch {
            return;
        }

        const nextConfig = action(previousConfig);
        const next = JSON.stringify(nextConfig, null, 2);

        const cursorPos = next.lastIndexOf(`""`) + 1;

        editorRef.current?.view?.focus();
        editorRef.current?.view?.dispatch({
            changes: {
                from: 0,
                to: value.length,
                insert: next,
            }
        });
        editorRef.current?.view?.dispatch({
            selection: { anchor: cursorPos, head: cursorPos }
        });
    }

    return (
        <>
            <div className="flex flex-row items-center flex-wrap w-full">
                {actions.map(({ name, fn }, index) => (
                    <div
                        key={index}
                        className="flex flex-row items-center"
                    >
                        <Button
                            variant="ghost"
                            className="disabled:opacity-100 disabled:pointer-events-auto disabled:cursor-not-allowed"
                            disabled={isQuickActionsDisabled}
                            onClick={(e) => {
                                e.preventDefault();
                                onQuickAction(fn);
                            }}
                        >
                            {name}
                        </Button>
                        {index !== actions.length - 1 && (
                            <Separator
                                orientation="vertical" className="h-4 mx-1"
                            />
                        )}
                    </div>
                ))}
            </div>
            <ScrollArea className="rounded-md border p-1 overflow-auto flex-1 h-64">
                <CodeMirror
                    ref={editorRef}
                    value={value}
                    onChange={onChange}
                    extensions={[
                        keymapExtension,
                        json(),
                        linter(jsonParseLinter(), {
                            delay: 300,
                        }),
                        linter(jsonSchemaLinter(), {
                            needsRefresh: handleRefresh,
                        }),
                        jsonLanguage.data.of({
                            autocomplete: jsonCompletion(),
                        }),
                        hoverTooltip(jsonSchemaHover()),
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        stateExtensions(schema as any),
                        customAutocompleteStyle,
                    ]}
                    theme={theme === "dark" ? "dark" : "light"}
                />
            </ScrollArea>
        </>
    )
}