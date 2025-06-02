import { StateField, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { ensureSyntaxTree } from "@codemirror/language";
import { measureSync } from "@/lib/utils";

export const SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE = "data-symbol-hover-target";

const decoration = Decoration.mark({
    class: "cm-underline-hover",
    attributes: { [SYMBOL_HOVER_TARGET_DATA_ATTRIBUTE]: "true" }
});

const NODE_TYPES = [
    // Typescript + Python
    "VariableName",
    "VariableDefinition",
    "TypeDefinition",
    "TypeName",
    "PropertyName",
    "PropertyDefinition",
    "JSXIdentifier",
    "Identifier",
    // C#
    "VarName",
    "TypeIdentifier",
    "PropertyName",
    "MethodName",
    "Ident",
    "ParamName",
    "AttrsNamedArg",
    // C/C++
    "Identifier",
    "NamespaceIdentifier",
    "FieldIdentifier",
    // Objective-C
    "variableName",
    "variableName.definition",
    // Java
    "Definition",
    // Rust
    "BoundIdentifier",
    // Go
    "DefName",
    "FieldName",
    // PHP
    "ClassMemberName",
    "Name"
]

export const symbolHoverTargetsExtension = StateField.define<DecorationSet>({
    create(state) {
        // @note: we need to use `ensureSyntaxTree` here (as opposed to `syntaxTree`)
        // because we want to parse the entire document, not just the text visible in
        // the current viewport.
        const { data: tree } = measureSync(() => ensureSyntaxTree(state, state.doc.length, Infinity), "ensureSyntaxTree");
        const decorations: Range<Decoration>[] = [];

        // @note: useful for debugging
        // const getTextAt = (from: number, to: number) => {
        //     const doc = state.doc;
        //     return doc.sliceString(from, to);
        // }

        tree?.iterate({
            enter: (node) => {
                // console.log(node.type.name, getTextAt(node.from, node.to));
                if (NODE_TYPES.includes(node.type.name) && node.from < node.to) {
                    decorations.push(decoration.range(node.from, node.to));
                }
            },
        });
        return Decoration.set(decorations);
    },
    update(deco, tr) {
        return deco.map(tr.changes);
    },
    provide: field => EditorView.decorations.from(field),
});