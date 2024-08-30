import { EditorSelection, Extension, StateEffect, StateField, Text, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { ZoektMatch } from "../types";

const matchMark = Decoration.mark({
    class: "cm-searchMatch"
});
const selectedMatchMark = Decoration.mark({
    class: "cm-searchMatch cm-searchMatch-selected"
});

const setMatchState = StateEffect.define<{
    selectedMatchIndex: number,
    matches: ZoektMatch[],
}>();

const getMatchRange = (match: ZoektMatch, document: Text) => {
    const line = document.line(match.LineNum);
    const fragment = match.Fragments[0];
    const from = line.from + fragment.Pre.length;
    const to = from + fragment.Match.length;
    return { from, to };
}


const matchHighlighter = StateField.define<DecorationSet>({
    create () {
        return Decoration.none;
    },
    update (highlights: DecorationSet, transaction: Transaction) {
        highlights = highlights.map(transaction.changes);

        for (const effect of transaction.effects) {
            if (effect.is(setMatchState)) {
                const { matches, selectedMatchIndex } = effect.value;

                const decorations = matches.map((match, index) => {
                    const { from, to } = getMatchRange(match, transaction.newDoc);
                    const mark = index === selectedMatchIndex ? selectedMatchMark : matchMark;
                    return mark.range(from, to);
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
    "&light .cm-searchMatch-selected": { backgroundColor: "#ff6a0054" },
    "&dark .cm-searchMatch-selected": { backgroundColor: "#ff00ff8a" }
});

export const markMatches = (selectedMatchIndex: number, matches: ZoektMatch[], view: EditorView) => {
    const setState = setMatchState.of({
        selectedMatchIndex,
        matches,
    });
    
    const effects = []
    effects.push(setState);

    if (selectedMatchIndex >= 0 && selectedMatchIndex < matches.length) {
        const match = matches[selectedMatchIndex];
        const { from, to } = getMatchRange(match, view.state.doc);
        const selection = EditorSelection.range(from, to);
        effects.push(EditorView.scrollIntoView(selection, {
            y: "start",
        }));
    };

    view.dispatch({ effects });
    return true;
}

export const searchResultHighlightExtension = (): Extension => {
    return [
        highlightTheme,
        matchHighlighter,
    ]
}
