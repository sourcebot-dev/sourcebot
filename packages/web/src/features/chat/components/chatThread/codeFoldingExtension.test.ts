/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, describe } from 'vitest'
import { 
    calculateVisibleRanges, 
    calculateHiddenRegions, 
    createCodeFoldingExtension, 
    updateReferencesEffect, 
    expandRegionEffect,
    updateReferences,
    expandRegion,
    FoldingState,
} from './codeFoldingExtension'
import { FileReference } from '../../types'
import { EditorState, StateField } from '@codemirror/state'

describe('calculateVisibleRanges', () => {
    test('applies padding to a single range', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: {
                    startLine: 10,
                    endLine: 15
                },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 7,  // 10 - 3
            endLine: 18    // 15 + 3
        }]);
    });

    test('merges overlapping ranges', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 12, endLine: 20 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 7,  // 10 - 3
            endLine: 23    // 20 + 3
        }]);
    });

    test('merges adjacent ranges (including padding)', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 19, endLine: 25 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        // Range 1: 7-18, Range 2: 16-28
        // Since 18 >= 16-1 (15), they should merge
        expect(visibleRanges).toEqual([{
            startLine: 7,
            endLine: 28
        }]);
    });

    test('keeps separate ranges when they dont overlap', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 25, endLine: 30 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([
            { startLine: 7, endLine: 18 },   // 10-15 with padding
            { startLine: 22, endLine: 33 }   // 25-30 with padding
        ]);
    });

    test('respects file boundaries - start of file', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 1, endLine: 5 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 1,  // Can't go below 1
            endLine: 8     // 5 + 3
        }]);
    });

    test('respects file boundaries - end of file', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 95, endLine: 100 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 92,  // 95 - 3
            endLine: 100    // Can't go above 100
        }]);
    });

    test('handles multiple ranges with complex overlaps', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 20, endLine: 25 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '3',
                type: 'file',
                range: { startLine: 22, endLine: 30 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '4',
                type: 'file',
                range: { startLine: 50, endLine: 55 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([
            { startLine: 7, endLine: 33 },   // All three ranges merge: 10-15, 20-25, 22-30 with padding
            { startLine: 47, endLine: 58 }   // Last range: 50-55 with padding
        ]);
    });

    test('returns full file when no ranges provided', () => {
        const references: FileReference[] = [];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 1,
            endLine: 100
        }]);
    });

    test('ignores references without ranges', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                // No range property
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([{
            startLine: 7,
            endLine: 18
        }]);
    });

    test('works with zero padding', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 0);

        expect(visibleRanges).toEqual([{
            startLine: 10,
            endLine: 15
        }]);
    });

    test('handles single line ranges', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 10 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 2);

        expect(visibleRanges).toEqual([{
            startLine: 8,
            endLine: 12
        }]);
    });

    test('sorts ranges by start line', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 50, endLine: 55 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '3',
                type: 'file',
                range: { startLine: 30, endLine: 35 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const visibleRanges = calculateVisibleRanges(references, 100, 3);

        expect(visibleRanges).toEqual([
            { startLine: 7, endLine: 18 },   // 10-15 range (sorted first)
            { startLine: 27, endLine: 38 },  // 30-35 range  
            { startLine: 47, endLine: 58 }   // 50-55 range
        ]);
    });
});

describe('calculateHiddenRegions', () => {
    test('calculates hidden regions between visible ranges', () => {
        const visibleRanges = [
            { startLine: 10, endLine: 20 },
            { startLine: 30, endLine: 40 },
            { startLine: 60, endLine: 70 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 100);

        expect(hiddenRegions).toEqual([
            { startLine: 1, endLine: 9, canExpandUp: true, canExpandDown: false },     // Before first range
            { startLine: 21, endLine: 29, canExpandUp: true, canExpandDown: true },   // Between first and second
            { startLine: 41, endLine: 59, canExpandUp: true, canExpandDown: true },   // Between second and third
            { startLine: 71, endLine: 100, canExpandUp: false, canExpandDown: true }  // After last range
        ]);
    });

    test('handles visible range starting at line 1', () => {
        const visibleRanges = [
            { startLine: 1, endLine: 10 },
            { startLine: 20, endLine: 30 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([
            { startLine: 11, endLine: 19, canExpandUp: true, canExpandDown: true },   // Between ranges
            { startLine: 31, endLine: 50, canExpandUp: false, canExpandDown: true }   // After last range
        ]);
    });

    test('handles visible range ending at last line', () => {
        const visibleRanges = [
            { startLine: 10, endLine: 20 },
            { startLine: 30, endLine: 50 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([
            { startLine: 1, endLine: 9, canExpandUp: true, canExpandDown: false },   // Before first range
            { startLine: 21, endLine: 29, canExpandUp: true, canExpandDown: true }   // Between ranges
        ]);
    });

    test('handles single visible range in middle', () => {
        const visibleRanges = [
            { startLine: 20, endLine: 30 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([
            { startLine: 1, endLine: 19, canExpandUp: true, canExpandDown: false },   // Before range
            { startLine: 31, endLine: 50, canExpandUp: false, canExpandDown: true }   // After range
        ]);
    });

    test('handles single visible range covering entire file', () => {
        const visibleRanges = [
            { startLine: 1, endLine: 50 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([]);
    });

    test('handles adjacent visible ranges', () => {
        const visibleRanges = [
            { startLine: 10, endLine: 20 },
            { startLine: 21, endLine: 30 }
        ];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([
            { startLine: 1, endLine: 9, canExpandUp: true, canExpandDown: false },   // Before first range
            { startLine: 31, endLine: 50, canExpandUp: false, canExpandDown: true }  // After last range
        ]);
    });

    test('handles empty visible ranges', () => {
        const visibleRanges: Array<{ startLine: number; endLine: number }> = [];

        const hiddenRegions = calculateHiddenRegions(visibleRanges, 50);

        expect(hiddenRegions).toEqual([]);
    });
});

describe('StateField Integration', () => {
    test('initial state calculation with references', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 25, endLine: 30 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const extension = createCodeFoldingExtension(references, 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        // Create document with 50 lines
        const doc = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join('\n');
        const state = EditorState.create({
            doc,
            extensions: [extension],
        });

        const foldingState = state.field(stateField);

        expect(foldingState.totalLines).toBe(50);
        expect(foldingState.references).toEqual(references);
        expect(foldingState.padding).toBe(3);
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 7, endLine: 18 },   // 10-15 with padding
            { startLine: 22, endLine: 33 }   // 25-30 with padding
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 6, canExpandUp: true, canExpandDown: false },     // Before first range
            { startLine: 19, endLine: 21, canExpandUp: true, canExpandDown: true },   // Between ranges
            { startLine: 34, endLine: 50, canExpandUp: false, canExpandDown: true }   // After last range
        ]);
    });

    test('initial state with no references shows entire file', () => {
        const extension = createCodeFoldingExtension([], 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
        const state = EditorState.create({
            doc,
            extensions: [extension],
        });

        const foldingState = state.field(stateField);

        expect(foldingState.totalLines).toBe(20);
        expect(foldingState.references).toEqual([]);
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 1, endLine: 20 }
        ]);
        expect(foldingState.hiddenRegions).toEqual([]);
    });

    test('updateReferencesEffect changes state correctly', () => {
        const extension = createCodeFoldingExtension([], 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join('\n');
        let state = EditorState.create({
            doc,
            extensions: [extension],
        });

        // Initially no references, should show entire file
        let foldingState = state.field(stateField);
        expect(foldingState.references).toEqual([]);
        expect(foldingState.visibleRanges).toEqual([{ startLine: 1, endLine: 30 }]);

        // Update references
        const newReferences: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 }
            }
        ];

        state = state.update({
            effects: [updateReferencesEffect.of(newReferences)]
        }).state;

        foldingState = state.field(stateField);
        expect(foldingState.references).toEqual(newReferences);
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 7, endLine: 18 }   // 10-15 with padding 3
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 6, canExpandUp: true, canExpandDown: false },
            { startLine: 19, endLine: 30, canExpandUp: false, canExpandDown: true }
        ]);
    });

    test('expandRegionEffect expands hidden region up', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 20, endLine: 25 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const extension = createCodeFoldingExtension(references, 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join('\n');
        let state = EditorState.create({
            doc,
            extensions: [extension],
        });

        // Initial state should have hidden regions before and after the visible range
        let foldingState = state.field(stateField);
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 17, endLine: 28 }   // 20-25 with padding 3
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 16, canExpandUp: true, canExpandDown: false },   // Before
            { startLine: 29, endLine: 50, canExpandUp: false, canExpandDown: true }   // After
        ]);

        // Expand the first hidden region (before the visible range) upward by 10 lines
        state = state.update({
            effects: [expandRegionEffect.of({ regionIndex: 0, direction: 'up', linesToExpand: 10 })]
        }).state;

        foldingState = state.field(stateField);
        
        // Should now have two visible ranges: the expanded region and the original range
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 7, endLine: 28 }   // Merged range (7-28)
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 6, canExpandUp: true, canExpandDown: false },   // Between expanded and original
            { startLine: 29, endLine: 50, canExpandUp: false, canExpandDown: true }   // After original range
        ]);
    });

    test('expandRegionEffect expands hidden region down', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 20, endLine: 25 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const extension = createCodeFoldingExtension(references, 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 50 }, (_, i) => `line${i + 1}`).join('\n');
        let state = EditorState.create({
            doc,
            extensions: [extension],
        });

        // Expand the last hidden region (after the visible range) downward by 10 lines  
        state = state.update({
            effects: [expandRegionEffect.of({ regionIndex: 1, direction: 'down', linesToExpand: 10 })]
        }).state;

        const foldingState = state.field(stateField);
        
        // Should now have merged ranges: the original range and the expanded region
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 17, endLine: 38 }   // Merged range: original (17-28) + expanded (29-38)
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 16, canExpandUp: true, canExpandDown: false },   // Before merged range
            { startLine: 39, endLine: 50, canExpandUp: false, canExpandDown: true }   // After merged range
        ]);
    });

    test('document changes recalculate state', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        const extension = createCodeFoldingExtension(references, 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
        let state = EditorState.create({
            doc,
            extensions: [extension],
        });

        let foldingState = state.field(stateField);
        expect(foldingState.totalLines).toBe(20);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 6, canExpandUp: true, canExpandDown: false },
            { startLine: 19, endLine: 20, canExpandUp: false, canExpandDown: true }
        ]);

        // Insert 10 new lines at the beginning
        const newLines = Array.from({ length: 10 }, (_, i) => `newline${i + 1}`).join('\n');
        state = state.update({
            changes: { from: 0, insert: newLines + '\n' }
        }).state;

        foldingState = state.field(stateField);
        expect(foldingState.totalLines).toBe(30);  // 20 + 10 (inserting 10 lines with newlines)
        
        // Hidden regions should be recalculated with new total lines
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 6, canExpandUp: true, canExpandDown: false },
            { startLine: 19, endLine: 30, canExpandUp: false, canExpandDown: true }
        ]);
    });

    test('action creators work correctly', () => {
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 10, endLine: 15 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        // Test updateReferences action creator
        const updateAction = updateReferences(references);
        expect(updateAction.effects).toHaveLength(1);
        expect(updateAction.effects[0].is(updateReferencesEffect)).toBe(true);
        expect(updateAction.effects[0].value).toEqual(references);

        // Test expandRegion action creator
        const expandAction = expandRegion(0, 'down', 15);
        expect(expandAction.effects).toHaveLength(1);
        expect(expandAction.effects[0].is(expandRegionEffect)).toBe(true);
        expect(expandAction.effects[0].value).toEqual({
            regionIndex: 0,
            direction: 'down',
            linesToExpand: 15
        });
    });

    test('complex state transitions with multiple effects', () => {
        const extension = createCodeFoldingExtension([], 3);
        const stateField = (extension as any)[0] as StateField<FoldingState>;
        
        const doc = Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join('\n');
        let state = EditorState.create({
            doc,
            extensions: [extension],
        });

        // Start with no references - should show entire file
        let foldingState = state.field(stateField);
        expect(foldingState.visibleRanges).toEqual([{ startLine: 1, endLine: 100 }]);

        // Add references
        const references: FileReference[] = [
            {
                path: 'test.ts',
                id: '1',
                type: 'file',
                range: { startLine: 20, endLine: 25 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            },
            {
                path: 'test.ts',
                id: '2',
                type: 'file',
                range: { startLine: 60, endLine: 65 },
                repo: 'github.com/sourcebot-dev/sourcebot'
            }
        ];

        state = state.update({
            effects: [updateReferencesEffect.of(references)]
        }).state;

        foldingState = state.field(stateField);
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 17, endLine: 28 },   // 20-25 with padding
            { startLine: 57, endLine: 68 }    // 60-65 with padding
        ]);
        expect(foldingState.hiddenRegions).toHaveLength(3);  // before, between, after

        // Expand the middle hidden region
        state = state.update({
            effects: [expandRegionEffect.of({ regionIndex: 1, direction: 'down', linesToExpand: 20 })]
        }).state;

        foldingState = state.field(stateField);
        // Should merge the first range with the expanded region
        expect(foldingState.visibleRanges).toEqual([
            { startLine: 17, endLine: 48 },   // Merged first range + expanded region
            { startLine: 57, endLine: 68 }    // Second range unchanged
        ]);
        expect(foldingState.hiddenRegions).toEqual([
            { startLine: 1, endLine: 16, canExpandUp: true, canExpandDown: false },   // Before all ranges
            { startLine: 49, endLine: 56, canExpandUp: true, canExpandDown: true },   // Between merged and second range
            { startLine: 69, endLine: 100, canExpandUp: false, canExpandDown: true }  // After all ranges
        ]);
    });
});