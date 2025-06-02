'use client';

import { StateField, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { BrowseHighlightRange } from "../../hooks/useBrowseNavigation";

const markDecoration = Decoration.mark({
    class: "searchMatch-selected",
});

const lineDecoration = Decoration.line({
    attributes: { class: "lineHighlight" },
});

export const rangeHighlightingExtension = (range: BrowseHighlightRange) => StateField.define<DecorationSet>({
    create(state) {
        const { start, end } = range;

        if ('column' in start && 'column' in end) {
            const from = state.doc.line(start.lineNumber).from + start.column - 1;
            const to = state.doc.line(end.lineNumber).from + end.column - 1;

            const decorations: Range<Decoration>[] = [];
            if (from < to) {
                decorations.push(markDecoration.range(from, to));
            }

            return Decoration.set(decorations);
        } else {
            const decorations: Range<Decoration>[] = [];
            for (let line = start.lineNumber; line <= end.lineNumber; line++) {
                decorations.push(lineDecoration.range(state.doc.line(line).from));
            }

            return Decoration.set(decorations);
        }
    },
    update(deco, tr) {
        return deco.map(tr.changes);
    },
    provide: (field) => EditorView.decorations.from(field),
});