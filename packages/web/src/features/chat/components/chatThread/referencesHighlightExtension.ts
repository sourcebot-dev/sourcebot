import { EditorState, Range, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { FileReference } from "../../types";

const lineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius chat-lineHighlight" },
});

const selectedLineDecoration = Decoration.line({
    attributes: { class: "cm-range-border-radius cm-range-border-shadow chat-lineHighlight-selected" },
});

const hoverLineDecoration = Decoration.line({
    attributes: { class: "chat-lineHighlight-hover" },
});

export const setHoveredIdEffect = StateEffect.define<string | undefined>();
export const setSelectedIdEffect = StateEffect.define<string | undefined>();

const hoveredSelectedField = StateField.define<{ hoveredId?: string; selectedId?: string }>({
    create: () => ({ hoveredId: undefined, selectedId: undefined }),
    update(state, tr) {
        let next = state;
        for (const effect of tr.effects) {
            if (effect.is(setHoveredIdEffect)) {
                next = { ...next, hoveredId: effect.value };
            }
            if (effect.is(setSelectedIdEffect)) {
                next = { ...next, selectedId: effect.value };
            }
        }
        return next;
    },
});

function getReferenceAtPos(references: FileReference[], x: number, y: number, view: EditorView): FileReference | undefined {
    const pos = view.posAtCoords({ x, y });
    if (pos === null) {
        return undefined;
    }

    // Check if position is within the main editor content area
    const rect = view.contentDOM.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return undefined;
    }

    const line = view.state.doc.lineAt(pos);
    const lineNumber = line.number;

    // Check if this line is part of any highlighted range
    const matchingRanges = references.filter(({ range }) =>
        range && lineNumber >= range.startLine && lineNumber <= range.endLine
    );

    // Sort by range length — shorter ranges are more specific and take priority.
    matchingRanges.sort((a, b) => {
        const aLength = (a.range!.endLine) - (a.range!.startLine);
        const bLength = (b.range!.endLine) - (b.range!.startLine);
        return aLength - bLength;
    });

    return matchingRanges[0];
}

function buildDecorations(state: EditorState, references: FileReference[], hoveredId: string | undefined, selectedId: string | undefined): DecorationSet {
    const decorations: Range<Decoration>[] = [];

    for (const { range, id } of references) {
        if (!range) {
            continue;
        }

        const isHovered = id === hoveredId;
        const isSelected = id === selectedId;

        for (let line = range.startLine; line <= range.endLine; line++) {
            // Skip lines that are outside the document bounds.
            if (line > state.doc.lines) {
                continue;
            }

            if (isSelected) {
                decorations.push(selectedLineDecoration.range(state.doc.line(line).from));
            } else {
                decorations.push(lineDecoration.range(state.doc.line(line).from));
                if (isHovered) {
                    decorations.push(hoverLineDecoration.range(state.doc.line(line).from));
                }
            }
        }
    }

    return Decoration.set(decorations, /* sort = */ true);
}

export function createReferencesHighlightExtension(
    references: FileReference[],
    onHoveredReferenceChanged: (reference?: FileReference) => void,
    onSelectedReferenceChanged: (reference?: FileReference) => void,
) {
    const decorationField = StateField.define<DecorationSet>({
        create(state) {
            const { hoveredId, selectedId } = state.field(hoveredSelectedField);
            return buildDecorations(state, references, hoveredId, selectedId);
        },
        update(deco, tr) {
            if (tr.effects.some(e => e.is(setHoveredIdEffect) || e.is(setSelectedIdEffect))) {
                const { hoveredId, selectedId } = tr.state.field(hoveredSelectedField);
                return buildDecorations(tr.state, references, hoveredId, selectedId);
            }
            return deco.map(tr.changes);
        },
        provide: (field) => EditorView.decorations.from(field),
    });

    return [
        hoveredSelectedField,
        decorationField,
        EditorView.domEventHandlers({
            click: (event, view) => {
                const reference = getReferenceAtPos(references, event.clientX, event.clientY, view);
                if (reference) {
                    const { selectedId } = view.state.field(hoveredSelectedField);
                    onSelectedReferenceChanged(reference.id === selectedId ? undefined : reference);
                    return true;
                }
                return false;
            },
            mouseover: (event, view) => {
                const reference = getReferenceAtPos(references, event.clientX, event.clientY, view);
                if (!reference) {
                    return false;
                }
                const { selectedId, hoveredId } = view.state.field(hoveredSelectedField);
                if (reference.id === selectedId || reference.id === hoveredId) {
                    return false;
                }
                onHoveredReferenceChanged(reference);
                return true;
            },
            mouseout: (event, view) => {
                const reference = getReferenceAtPos(references, event.clientX, event.clientY, view);
                if (reference) {
                    return false;
                }
                onHoveredReferenceChanged(undefined);
                return true;
            },
        }),
    ];
}
