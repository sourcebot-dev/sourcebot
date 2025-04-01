'use client';

import { EditorState, Extension, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
    const viewRef = useRef<EditorView>();
    const stateRef = useRef<EditorState>();

    useImperativeHandle(ref, () => ({
        editor: editor.current,
        state: stateRef.current,
        view: viewRef.current,
    }), []);

    useEffect(() => {
        if (!editor.current) {
            return;
        }

        const state = EditorState.create({
            extensions: [], /* extensions are explicitly left out here */
            doc: value,
        });
        stateRef.current = state;

        const view = new EditorView({
            state,
            parent: editor.current,
        });
        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = undefined;
            stateRef.current = undefined;
        }
    }, [value]);

    useEffect(() => {
        if (viewRef.current) {
            viewRef.current.dispatch({ effects: StateEffect.reconfigure.of(extensions ?? []) });
        }
    }, [extensions]);

    return (
        <div
            className={className}
            ref={editor}
        />
    )
});

LightweightCodeMirror.displayName = "LightweightCodeMirror";

export { LightweightCodeMirror };