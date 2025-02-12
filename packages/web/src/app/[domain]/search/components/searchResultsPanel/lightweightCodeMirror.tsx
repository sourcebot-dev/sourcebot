'use client';

import { EditorState, Extension, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface CodeMirrorProps {
    value?: string;
    extensions?: Extension[];
    className?: string;
}

export interface CodeMirrorRef {
    editor: HTMLDivElement | null;
    state?: EditorState;
    view?: EditorView;
}

/**
 * This component provides a lightweight CodeMirror component that has been optimized to
 * render quickly in the search results panel. Why not use react-codemirror? For whatever reason,
 * react-codemirror issues many StateEffects when first rendering, causing a stuttery scroll
 * experience as new cells load. This component is a workaround for that issue and provides
 * a minimal react wrapper around CodeMirror that avoids this issue.
 */
const LightweightCodeMirror = forwardRef<CodeMirrorRef, CodeMirrorProps>(({
    value,
    extensions,
    className,
}, ref) => {
    const editor = useRef<HTMLDivElement | null>(null);
    const [view, setView] = useState<EditorView>();
    const [state, setState] = useState<EditorState>();

    useImperativeHandle(ref, () => ({
        editor: editor.current,
        state,
        view,
    }), [editor, state, view]);

    useEffect(() => {
        if (!editor.current) {
            return;
        }

        const state = EditorState.create({
            extensions: [], /* extensions are explicitly left out here */
            doc: value,
        });
        setState(state);

        const view = new EditorView({
            state,
            parent: editor.current,
        });
        setView(view);

        // console.debug(`[CM] Editor created.`);

        return () => {
            view.destroy();
            setView(undefined);
            setState(undefined);
            // console.debug(`[CM] Editor destroyed.`);
        }

    }, [value]);

    useEffect(() => {
        if (view) {
            view.dispatch({ effects: StateEffect.reconfigure.of(extensions ?? []) });
            // console.debug(`[CM] Editor reconfigured.`);
        }
    }, [extensions, view]);

    return (
        <div
            className={className}
            ref={editor}
        />
    )
});

LightweightCodeMirror.displayName = "LightweightCodeMirror";

export { LightweightCodeMirror };