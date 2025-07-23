import { Extension, StateField, StateEffect, Transaction, Range as CodeMirrorRange, EditorState } from "@codemirror/state";
import { 
    Decoration, 
    DecorationSet, 
    EditorView,
    WidgetType
} from "@codemirror/view";
import { FileReference } from "../../types";
import React, { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { CodeFoldingExpandButton } from "./codeFoldingExpandButton";
import { gutterWidthExtension } from "@/lib/extensions/gutterWidthExtension";

interface Range {
    startLine: number;
    endLine: number;
}

interface HiddenRegion {
    startLine: number;
    endLine: number;
    canExpandUp: boolean;
    canExpandDown: boolean;
}

export interface FoldingState {
    visibleRanges: Range[];
    hiddenRegions: HiddenRegion[];
    totalLines: number;
    references: FileReference[];
    padding: number;
}

// State effects for updating folding state
export const updateReferencesEffect = StateEffect.define<FileReference[]>();
export const expandRegionEffect = StateEffect.define<{
    regionIndex: number;
    direction: 'up' | 'down';
    linesToExpand: number;
}>();

// Range calculation utilities
export const calculateVisibleRanges = (
    references: FileReference[],
    totalLines: number,
    padding: number = 3
): Range[] => {
    // Extract ranges from references that have them
    const ranges: Range[] = references
        .filter(ref => ref.range !== undefined)
        .map(ref => ({
            startLine: Math.max(1, ref.range!.startLine - padding),
            endLine: Math.min(totalLines, ref.range!.endLine + padding),
        }));

    // If no ranges, show everything
    if (ranges.length === 0) {
        return [{ startLine: 1, endLine: totalLines }];
    }

    // Sort ranges by start line
    ranges.sort((a, b) => a.startLine - b.startLine);

    // Merge overlapping ranges
    const mergedRanges: Range[] = [];
    let currentRange = ranges[0];

    for (let i = 1; i < ranges.length; i++) {
        const nextRange = ranges[i];
        
        // Check if ranges overlap or are adjacent
        if (currentRange.endLine >= nextRange.startLine - 1) {
            // Merge ranges
            currentRange.endLine = Math.max(currentRange.endLine, nextRange.endLine);
        } else {
            // No overlap, add current range and start new one
            mergedRanges.push(currentRange);
            currentRange = nextRange;
        }
    }
    
    // Add the last range
    mergedRanges.push(currentRange);

    return mergedRanges;
};

export const calculateHiddenRegions = (
    visibleRanges: Range[],
    totalLines: number
): HiddenRegion[] => {
    const hiddenRegions: HiddenRegion[] = [];

    // Hidden region before first visible range
    if (visibleRanges.length > 0 && visibleRanges[0].startLine > 1) {
        hiddenRegions.push({
            startLine: 1,
            endLine: visibleRanges[0].startLine - 1,
            canExpandUp: true,     // Can expand toward start of file
            canExpandDown: false,  // Can't expand toward visible content
        });
    }

    // Hidden regions between visible ranges
    for (let i = 0; i < visibleRanges.length - 1; i++) {
        const currentRange = visibleRanges[i];
        const nextRange = visibleRanges[i + 1];

        if (currentRange.endLine + 1 < nextRange.startLine) {
            hiddenRegions.push({
                startLine: currentRange.endLine + 1,
                endLine: nextRange.startLine - 1,
                canExpandUp: true,
                canExpandDown: true,
            });
        }
    }

    // Hidden region after last visible range
    if (visibleRanges.length > 0) {
        const lastRange = visibleRanges[visibleRanges.length - 1];
        if (lastRange.endLine < totalLines) {
            hiddenRegions.push({
                startLine: lastRange.endLine + 1,
                endLine: totalLines,
                canExpandUp: false,   // Can't expand toward visible content
                canExpandDown: true,  // Can expand toward end of file
            });
        }
    }

    return hiddenRegions;
};

export const createFoldingState = (
    references: FileReference[],
    totalLines: number,
    padding: number = 3
): FoldingState => {
    const visibleRanges = calculateVisibleRanges(references, totalLines, padding);
    const hiddenRegions = calculateHiddenRegions(visibleRanges, totalLines);

    return {
        visibleRanges,
        hiddenRegions,
        totalLines,
        references,
        padding,
    };
};

// State field management is now handled inside createCodeFoldingExtension

// Helper function to recalculate folding state
const recalculateFoldingState = (state: FoldingState): FoldingState => {
    const visibleRanges = calculateVisibleRanges(state.references, state.totalLines, state.padding);
    const hiddenRegions = calculateHiddenRegions(visibleRanges, state.totalLines);

    return {
        ...state,
        visibleRanges,
        hiddenRegions,
    };
};

// Helper function to expand a region
const expandRegionInternal = (
    currentState: FoldingState,
    hiddenRegionIndex: number,
    direction: 'up' | 'down',
    linesToExpand: number = 20
): FoldingState => {
    const hiddenRegion = currentState.hiddenRegions[hiddenRegionIndex];
    if (!hiddenRegion) return currentState;

    const newVisibleRanges = [...currentState.visibleRanges];
    
    if (direction === 'up' && hiddenRegion.canExpandUp) {
        const startLine = Math.max(hiddenRegion.startLine, hiddenRegion.endLine - linesToExpand + 1);
        newVisibleRanges.push({
            startLine,
            endLine: hiddenRegion.endLine,
        });
    } else if (direction === 'down' && hiddenRegion.canExpandDown) {
        const endLine = Math.min(hiddenRegion.endLine, hiddenRegion.startLine + linesToExpand - 1);
        newVisibleRanges.push({
            startLine: hiddenRegion.startLine,
            endLine,
        });
    }

    // Sort and merge overlapping ranges
    const sortedRanges = newVisibleRanges.sort((a, b) => a.startLine - b.startLine);
    const mergedRanges = mergeOverlappingRanges(sortedRanges);
    const newHiddenRegions = calculateHiddenRegions(mergedRanges, currentState.totalLines);

    return {
        ...currentState,
        visibleRanges: mergedRanges,
        hiddenRegions: newHiddenRegions,
    };
};

const mergeOverlappingRanges = (ranges: Range[]): Range[] => {
    if (ranges.length === 0) return [];

    // Sort ranges by start line
    const sortedRanges = [...ranges].sort((a, b) => a.startLine - b.startLine);
    
    const merged: Range[] = [];
    let currentRange = sortedRanges[0];

    for (let i = 1; i < sortedRanges.length; i++) {
        const nextRange = sortedRanges[i];
        
        // Check if ranges overlap or are adjacent
        if (currentRange.endLine >= nextRange.startLine - 1) {
            currentRange.endLine = Math.max(currentRange.endLine, nextRange.endLine);
        } else {
            merged.push(currentRange);
            currentRange = nextRange;
        }
    }
    
    merged.push(currentRange);
    return merged;
};

// Action creators for dispatching state updates
export const updateReferences = (references: FileReference[]) => {
    return {
        effects: [updateReferencesEffect.of(references)],
    };
};

export const expandRegion = (regionIndex: number, direction: 'up' | 'down', linesToExpand: number = 20) => {
    return {
        effects: [expandRegionEffect.of({ regionIndex, direction, linesToExpand })],
    };
};


// Widget for expand buttons
class CodeFoldingExpandButtonWidget extends WidgetType {
    constructor(
        private regionIndex: number,
        private direction: 'up' | 'down',
        private canExpandUp: boolean,
        private canExpandDown: boolean,
        private hiddenLineCount: number
    ) {
        super();
    }

    toDOM(view: EditorView): HTMLElement {
        const container = document.createElement('div');
        container.className = 'cm-code-folding-expand-container';
       
        // Create React root and render component
        const root = createRoot(container);
        root.render(
            React.createElement(CodeFoldingExpandButton, {
                hiddenLineCount: this.hiddenLineCount,
                canExpandUp: this.canExpandUp,
                canExpandDown: this.canExpandDown,
                onExpand: (direction) => {
                    view.dispatch({
                        effects: [expandRegionEffect.of({ 
                            regionIndex: this.regionIndex, 
                            direction, 
                            linesToExpand: 20 
                        })]
                    });
                },
            })
        );

        // Store references for potential updates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (container as any)._codeFoldingRoot = root;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (container as any)._updateStyling = (newGutterWidth: number) => {
            this.updateContainerStyling(container, newGutterWidth);
        };

        return container;
    }

    private updateContainerStyling(container: HTMLElement, gutterWidth: number) {
        container.style.marginLeft = `-${gutterWidth}px`;
        container.style.width = `calc(100% + ${gutterWidth}px)`;
    }

    eq(other: CodeFoldingExpandButtonWidget): boolean {
        return (
            this.regionIndex === other.regionIndex &&
            this.direction === other.direction &&
            this.canExpandUp === other.canExpandUp &&
            this.canExpandDown === other.canExpandDown &&
            this.hiddenLineCount === other.hiddenLineCount
        );
    }
}

// Function to create decorations from folding state
const createDecorations = (state: EditorState, foldingState: FoldingState): DecorationSet => {
    const decorations: CodeMirrorRange<Decoration>[] = [];

    // Create decorations for each hidden region
    foldingState.hiddenRegions.forEach((region, index) => {

        // Catch cases where the region is outside the document bounds.
        if (
            region.startLine < 1 ||
            region.startLine > state.doc.lines ||
            region.endLine < 1 ||
            region.endLine > state.doc.lines
        ) {
            return;
        }

        const from = state.doc.line(region.startLine).from;
        const to = state.doc.line(region.endLine).to;
        const hiddenLineCount = region.endLine - region.startLine + 1;

        // Create a widget that replaces the hidden region
        const widget = new CodeFoldingExpandButtonWidget(
            index,
            'down', // Default direction
            region.canExpandUp,
            region.canExpandDown,
            hiddenLineCount
        );

        // Replace the entire hidden region with the expand button
        const decoration = Decoration.replace({
            widget,
            block: true,
            inclusive: true,
        });

        decorations.push(decoration.range(from, to));
    });

    return Decoration.set(decorations);
};

// Combined StateField that manages both folding state and decorations
interface FoldingStateWithDecorations extends FoldingState {
    decorations: DecorationSet;
}

const createFoldingStateWithDecorations = (
    references: FileReference[],
    totalLines: number,
    padding: number = 3
): FoldingStateWithDecorations => {
    const visibleRanges = calculateVisibleRanges(references, totalLines, padding);
    const hiddenRegions = calculateHiddenRegions(visibleRanges, totalLines);
    
    const foldingState: FoldingState = {
        visibleRanges,
        hiddenRegions,
        totalLines,
        references,
        padding,
    };
    
    return {
        ...foldingState,
        decorations: Decoration.set([]), // Will be updated in the create function
    };
};

export const createCodeFoldingExtension = (
    references: FileReference[] = [],
    padding: number = 3
): Extension => {
    const foldingStateField = StateField.define<FoldingStateWithDecorations>({
        create(state): FoldingStateWithDecorations {
            const totalLines = state.doc.lines;
            const stateWithDecorations = createFoldingStateWithDecorations(references, totalLines, padding);
            
            // Create decorations for the initial state
            const decorations = createDecorations(state, stateWithDecorations);
            
            return {
                ...stateWithDecorations,
                decorations,
            };
        },

        update(currentState: FoldingStateWithDecorations, transaction: Transaction): FoldingStateWithDecorations {
            let newState = currentState;

            // Update total lines if document changed
            if (transaction.docChanged) {
                const newTotalLines = transaction.newDoc.lines;
                if (newTotalLines !== currentState.totalLines) {
                    newState = {
                        ...currentState,
                        totalLines: newTotalLines,
                    };
                    // Recalculate ranges with new total lines
                    const recalculatedState = recalculateFoldingState(newState);
                    newState = {
                        ...recalculatedState,
                        decorations: newState.decorations,
                    };
                }
            }

            // Handle state effects
            for (const effect of transaction.effects) {
                if (effect.is(updateReferencesEffect)) {
                    newState = {
                        ...newState,
                        references: effect.value,
                    };
                    const recalculatedState = recalculateFoldingState(newState);
                    newState = {
                        ...recalculatedState,
                        decorations: newState.decorations,
                    };
                } else if (effect.is(expandRegionEffect)) {
                    const expandedState = expandRegionInternal(newState, effect.value.regionIndex, effect.value.direction, effect.value.linesToExpand);
                    newState = {
                        ...expandedState,
                        decorations: newState.decorations,
                    };
                }
            }

            // Update decorations if state changed or document changed
            if (newState !== currentState || transaction.docChanged) {
                const decorations = createDecorations(transaction.state, newState);
                newState = {
                    ...newState,
                    decorations,
                };
            } else {
                // Map existing decorations to new document
                newState = {
                    ...newState,
                    decorations: currentState.decorations.map(transaction.changes),
                };
            }

            return newState;
        },
        
        provide: field => EditorView.decorations.from(field, state => state.decorations),
    });

    // View plugin to handle gutter width updates
    const gutterUpdatePlugin = EditorView.updateListener.of((update) => {
        if (update.geometryChanged) {
            const gutterPlugin = update.view.plugin(gutterWidthExtension);
            if (gutterPlugin) {
                const newGutterWidth = gutterPlugin.width;
                
                // Update all expand button containers
                const expandContainers = update.view.dom.querySelectorAll('.cm-code-folding-expand-container');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expandContainers.forEach((container: any) => {
                    if (container._updateStyling) {
                        container._updateStyling(newGutterWidth);
                    }
                });
            }
        }
    });

    const codeFoldingTheme = EditorView.theme({
        '.cm-code-folding-expand-container': {
            marginLeft: '0px',
            width: '100%',
            zIndex: 300,
            cursor: 'pointer',
        } satisfies CSSProperties,
        
        // Remove top padding from cm-content
        '.cm-content': {
            paddingTop: '0px',
            paddingBottom: '0px',
        } satisfies CSSProperties,

        // This is required, otherwise the expand button will not be clickable
        // when it is rendered over the gutter
        '.cm-gutters': {
            pointerEvents: 'none',
        } satisfies CSSProperties,
    });

    return [
        foldingStateField,
        gutterWidthExtension,
        gutterUpdatePlugin,
        codeFoldingTheme,
    ];
};

