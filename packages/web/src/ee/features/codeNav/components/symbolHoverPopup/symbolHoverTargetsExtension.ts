import { StateField, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { ensureSyntaxTree } from "@codemirror/language";
import { getStyleTags, tags as t } from "@lezer/highlight";
import { measureSync } from "@/lib/utils";

export const SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE = "data-symbol-hover-target";

const decoration = Decoration.mark({
    class: "cm-underline-hover",
    attributes: { [SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE]: "true" }
});

export const symbolHoverTargetsExtension = StateField.define<DecorationSet>({
    create(state) {
        // @note: we need to use `ensureSyntaxTree` here (as opposed to `syntaxTree`)
        // because we want to parse the entire document, not just the text visible in
        // the current viewport.
        const { data: tree } = measureSync(() => ensureSyntaxTree(state, state.doc.length, Infinity), "ensureSyntaxTree");
        const decorations: Range<Decoration>[] = [];

        tree?.iterate({
            enter: (node) => {
                if (node.from >= node.to) {
                    return;
                }
                const styleTags = getStyleTags(node);
                if (!styleTags) {
                    return;
                }
                // `Tag.set` is a tag's parent chain. All identifier-shaped highlight tags
                // (variableName, typeName, propertyName, etc.) — including modifier-wrapped
                // forms like `definition(variableName)` — descend from `tags.name`.
                const isIdentifier = styleTags.tags.some(tag => tag.set.includes(t.name));
                if (isIdentifier) {
                    decorations.push(decoration.range(node.from, node.to));
                }
            },
        });
        return Decoration.set(decorations, /* sort = */ true);
    },
    update(deco, tr) {
        return deco.map(tr.changes);
    },
    provide: field => EditorView.decorations.from(field),
});