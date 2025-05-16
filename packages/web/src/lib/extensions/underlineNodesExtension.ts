import { StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Returns a CodeMirror extension that underlines all nodes of the given types on hover.
 * @param nodeTypeNames Array of node type names to underline (e.g., ["VariableName", "TypeDefinition"])
 */
export function underlineNodesExtension(nodeTypeNames: string[]) {
    const underlineDecoration = Decoration.mark({
        class: "cm-underline-hover",
        attributes: { "data-underline-node": "true" }
    });


    return StateField.define<DecorationSet>({
        create(state) {
            const tree = syntaxTree(state);
            const decorations: any[] = [];

            const getTextAt = (from: number, to: number) => {
                const doc = state.doc;
                return doc.sliceString(from, to);
            }

            tree.iterate({
                enter: (node) => {
                    const text = getTextAt(node.from, node.to);
                    console.log(node.type.name, text);
                    if (nodeTypeNames.includes(node.type.name)) {
                        decorations.push(underlineDecoration.range(node.from, node.to));
                    }
                }
            });
            return Decoration.set(decorations);
        },
        update(deco, tr) {
            return deco.map(tr.changes);
        },
        provide: field => EditorView.decorations.from(field),
    });
} 