'use client';

import { Compartment, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo } from "react";

/**
 * @see https://thetrevorharmon.com/blog/codemirror-and-react/
 */
export function useExtensionWithDependency(
    view: EditorView | null,
    extensionFactory: () => Extension,
    deps: unknown[],
) {
    const compartment = useMemo(() => new Compartment(), []);
    // extensionFactory is intentionally excluded from deps — it only computes the
    // initial value. Subsequent updates are handled by compartment.reconfigure() in
    // the effect below, keeping the returned extension reference stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const extension = useMemo(() => compartment.of(extensionFactory()), [compartment]);

    useEffect(() => {
        if (view) {
            try {
                view.dispatch({
                    effects: compartment.reconfigure(extensionFactory()),
                });
            
            // @note: we were getting "RangeError: Position X is out of range for changeset of length Y" errors
            // spuriously for some reason. This is a dirty hack to prevent codemirror from crashing the app
            // in those cases.
            } catch (error) {
                console.error(error);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return extension;
}