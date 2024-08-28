'use client';

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditorView, keymap, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Cross1Icon, FileIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import CodeMirror from '@uiw/react-codemirror';
import { vim } from "@replit/codemirror-vim";
import { defaultKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { Scrollbar } from "@radix-ui/react-scroll-area";

interface CodePreviewProps {
    code: string;
    filepath: string;
    keymapType: "default" | "vim";
    onClose: () => void;
}

export const CodePreview = ({
    code,
    filepath,
    keymapType,
    onClose,
}: CodePreviewProps) => {
    const { theme: _theme, systemTheme } = useTheme();
    const theme = useMemo(() => {
        if (_theme === "system") {
            return systemTheme ?? "light";
        }

        return _theme ?? "light";
    }, [_theme, systemTheme]);

    const [gutterWidth, setGutterWidth] = useState(0);
    const gutterWidthPlugin = useMemo(() => {
        return ViewPlugin.fromClass(class {
            width: number = 0;
            constructor(view: EditorView) {
                this.measureWidth(view)
            }
            update(update: ViewUpdate) {
                if (update.geometryChanged) this.measureWidth(update.view)
            }
            measureWidth(view: EditorView) {
                let gutter = view.scrollDOM.querySelector('.cm-gutters') as HTMLElement
                if (gutter) this.width = gutter.offsetWidth
            }
        });
    }, []);

    return (
        <div className="h-full">
            <div className="flex flex-row bg-cyan-200 dark:bg-cyan-900 items-center justify-between pr-3">
                <div className="flex flex-row">
                    <div
                        style={{ width: `${gutterWidth}px` }}
                        className="flex justify-center items-center"
                    >
                        <FileIcon className="h-4 w-4" />
                    </div>
                    <span>{filepath}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Cross1Icon
                        className="h-4 w-4"
                        onClick={onClose}
                    />
                </Button>
            </div>
            <ScrollArea className="h-full overflow-y-auto">
                <CodeMirror
                    readOnly={true}
                    value={code}
                    theme={theme === "dark" ? "dark" : "light"}
                    extensions={[
                        ...(keymapType === "vim" ? [
                            vim(),
                        ] : [
                            keymap.of(defaultKeymap),
                        ]),
                        javascript(),
                        gutterWidthPlugin.extension,
                        EditorView.updateListener.of(update => {
                            const width = update.view.plugin(gutterWidthPlugin)?.width;
                            if (width) {
                                setGutterWidth(width);
                            }
                        })
                    ]}
                />
                <Scrollbar orientation="vertical" />
            </ScrollArea>
        </div>
    )
}