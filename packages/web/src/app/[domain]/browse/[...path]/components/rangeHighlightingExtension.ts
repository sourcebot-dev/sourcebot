'use client';

import { StateField, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { BrowseHighlightRange } from "../../hooks/utils";

const markDecoration = Decoration.mark({
    class: "searchMatch-selected",
});

const lineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius lineHighlight" },
});

export const rangeHighlightingExtension = (range: BrowseHighlightRange) => StateField.define<DecorationSet>({
    create(state) {
        const { start, end } = range;

        if (start.lineNumber > state.doc.lines || end.lineNumber > state.doc.lines) {
            console.warn(`Highlight range is out of bounds: start.lineNumber=${start.lineNumber}, end.lineNumber=${end.lineNumber}, doc.lines=${state.doc.lines}`);
            return Decoration.none;
        }

        if ('column' in start && 'column' in end) {
            const from = state.doc.line(start.lineNumber).from + start.column - 1;
            const to = state.doc.line(end.lineNumber).from + end.column - 1;

            const decorations: Range<Decoration>[] = [];
            if (from < to) {
                decorations.push(markDecoration.range(from, to));
            }

            return Decoration.set(decorations, /* sort = */ true);
        } else {
            const decorations: Range<Decoration>[] = [];
            for (let line = start.lineNumber; line <= end.lineNumber; line++) {
                decorations.push(lineDecoration.range(state.doc.line(line).from));
            }

            return Decoration.set(decorations, /* sort = */ true);
        }
    },
    update(deco, tr) {
        return deco.map(tr.changes);
    },
    provide: (field) => EditorView.decorations.from(field),
});