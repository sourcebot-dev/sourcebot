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
import { useRef, forwardRef, useImperativeHandle, Ref, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Schema } from "ajv";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { CodeHostType } from "@/lib/utils";

export type QuickActionFn<T> = (previous: T) => T;
export type QuickAction<T> = {
    name: string;
    fn: QuickActionFn<T>;
    description?: string | ReactNode;
    selectionText?: string;
};

interface ConfigEditorProps<T> {
    value: string;
    type: CodeHostType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChange: (...event: any[]) => void;
    actions: QuickAction<T>[],
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

export function onQuickAction<T>(
    action: QuickActionFn<T>,
    config: string,
    view: EditorView,
    options?: {
        focusEditor?: boolean;
        moveCursor?: boolean;
        selectionText?: string;
    }
) {
    const {
        focusEditor = false,
        moveCursor = true,
        selectionText = `""`,
    } = options ?? {};

    let previousConfig: T;
    try {
        previousConfig = JSON.parse(config) as T;
    } catch {
        return;
    }

    const nextConfig = action(previousConfig);
    const next = JSON.stringify(nextConfig, null, 2);

    if (focusEditor) {
        view.focus();
    }

    view.dispatch({
        changes: {
            from: 0,
            to: config.length,
            insert: next,
        }
    });

    if (moveCursor && selectionText) {
        const cursorPos = next.lastIndexOf(selectionText);
        if (cursorPos >= 0) {
            view.dispatch({
                selection: { 
                    anchor: cursorPos,
                    head: cursorPos + selectionText.length
                }
            });
        }
    }
}

export const isConfigValidJson = (config: string) => {
    try {
        JSON.parse(config);
        return true;
    } catch (_e) {
        return false;
    }
}

const DEFAULT_ACTIONS_VISIBLE = 4;

const ConfigEditor = <T,>(props: ConfigEditorProps<T>, forwardedRef: Ref<ReactCodeMirrorRef>) => {
    const { value, type, onChange, actions, schema } = props;
    const captureEvent = useCaptureEvent();
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [isViewMoreActionsEnabled, setIsViewMoreActionsEnabled] = useState(false);

    useImperativeHandle(
        forwardedRef,
        () => editorRef.current as ReactCodeMirrorRef
    );

    const keymapExtension = useKeymapExtension(editorRef.current?.view);
    const { theme } = useThemeNormalized();

    return (
        <div className="border rounded-md">
            <div className="flex flex-row items-center flex-wrap p-1">
                <TooltipProvider>
                    {actions
                        .slice(0, isViewMoreActionsEnabled ? actions.length : DEFAULT_ACTIONS_VISIBLE)
                        .map(({ name, fn, description, selectionText }, index, truncatedActions) => (
                            <div
                                key={index}
                                className="flex flex-row items-center"
                            >
                                <Tooltip
                                    delayDuration={100}
                                >
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="disabled:opacity-100 disabled:pointer-events-auto disabled:cursor-not-allowed text-sm font-mono tracking-tight"
                                            size="sm"
                                            disabled={!isConfigValidJson(value)}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                captureEvent('wa_config_editor_quick_action_pressed', {
                                                    name,
                                                    type,
                                                });
                                                if (editorRef.current?.view) {
                                                    onQuickAction(fn, value, editorRef.current.view, {
                                                        focusEditor: true,
                                                        selectionText,
                                                    });
                                                }
                                            }}
                                        >
                                            {name}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                        hidden={!description}
                                        className="max-w-xs"
                                    >
                                        {description}
                                    </TooltipContent>
                                </Tooltip>
                                {index !== truncatedActions.length - 1 && (
                                    <Separator
                                        orientation="vertical" className="h-4 mx-1"
                                    />
                                )}
                                {index === truncatedActions.length - 1 && truncatedActions.length < actions.length && (
                                    <>
                                        <Separator
                                            orientation="vertical" className="h-4 mx-1"
                                        />
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="text-xs text-muted-foreground"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setIsViewMoreActionsEnabled(!isViewMoreActionsEnabled);
                                            }}
                                        >
                                            +{actions.length - truncatedActions.length} more
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}

                </TooltipProvider>
            </div>
            <Separator />

            <ScrollArea className="p-1 overflow-auto flex-1 h-56">
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
            
        </div>
    )
};

// @see: https://stackoverflow.com/a/78692562
export default forwardRef(ConfigEditor) as <T>(
    props: ConfigEditorProps<T> & { ref?: Ref<ReactCodeMirrorRef> },
) => ReturnType<typeof ConfigEditor>;
