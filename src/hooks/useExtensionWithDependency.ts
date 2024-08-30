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
    const extension = useMemo(() => compartment.of(extensionFactory()), [compartment, extensionFactory]);

    useEffect(() => {
        if (view) {
            view.dispatch({
                effects: compartment.reconfigure(extensionFactory()),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return extension;
}