import { Extension, StateEffect, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { ZoektMatch } from "../types";

const matchMark = Decoration.mark({
    class: "cm-searchMatch"
});

const setMatches = StateEffect.define<ZoektMatch[]>();

const matchHighlighter = StateField.define<DecorationSet>({
    create () {
        return Decoration.none;
    },
    update (highlights: DecorationSet, transaction: Transaction) {
        highlights = highlights.map(transaction.changes);

        for (const effect of transaction.effects) {
            if (effect.is(setMatches)) {
                const decorations = effect.value.map(match => {
                    const line = transaction.newDoc.line(match.LineNum);
                    const fragment = match.Fragments[0];
                    const from = line.from + fragment.Pre.length;
                    const to = from + fragment.Match.length;
                    return matchMark.range(from, to);
                });

                highlights = Decoration.set(decorations)
            }
        }

        return highlights;
    },
    provide: (field) => EditorView.decorations.from(field),
});

const highlightTheme = EditorView.baseTheme({
    "&light .cm-searchMatch": { backgroundColor: "#ffff0054" },
    "&dark .cm-searchMatch": { backgroundColor: "#00ffff8a" },
});

export const markMatches = (matches: ZoektMatch[], view: EditorView) => {
    const effect: StateEffect<ZoektMatch[]> = setMatches.of(matches);
    view.dispatch({ effects: [effect] });
    return true;
}

export const searchResultHighlightExtension = (): Extension => {
    return [
        highlightTheme,
        matchHighlighter,
    ]
}
