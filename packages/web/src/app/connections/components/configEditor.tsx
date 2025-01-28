'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { useKeymapExtension } from "@/hooks/useKeymapExtension";
import { useThemeNormalized } from "@/hooks/useThemeNormalized";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
    handleRefresh,
    jsonCompletion,
    jsonSchemaHover,
    jsonSchemaLinter,
    stateExtensions
} from "codemirror-json-schema";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";


interface ConfigEditorProps {
    value: string;
    onChange: (...event: any[]) => void;
    actions: {
        name: string;
        fn: QuickActionFn;
    }[],
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

type QuickActionFn = (previous: ConnectionConfig) => ConnectionConfig;

export const ConfigEditor = ({
    value,
    onChange,
    actions,
}: ConfigEditorProps) => {
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();

    const onQuickAction = (e: any, action: QuickActionFn) => {
        e.preventDefault();
        let previousConfig: ConnectionConfig;
        try {
            previousConfig = JSON.parse(value) as ConnectionConfig;
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
            <div className="flex flex-row items-center gap-x-1 flex-wrap w-full">
                {actions.map(({ name, fn }, index) => (
                    <>
                        <Button
                            key={index}
                            variant="ghost"
                            onClick={(e) => onQuickAction(e, fn)}
                        >
                            {name}
                        </Button>
                        {index !== actions.length - 1 && (
                            <Separator
                                key={`separator-${index}`}
                                orientation="vertical" className="h-4"
                            />
                        )}
                    </>
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
                        // @todo: we will need to validate the config against different schemas based on the type of connection.
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        stateExtensions(githubSchema as any),
                        customAutocompleteStyle,
                    ]}
                    theme={theme === "dark" ? "dark" : "light"}
                />
            </ScrollArea>
        </>
    )
}