import { describe, expect, test } from 'vitest';
import { shouldUsePlainComposerEnterBehavior } from './keyboard';

describe('shouldUsePlainComposerEnterBehavior', () => {
    test('uses plain enter behavior when there is no suggestion mode', () => {
        expect(shouldUsePlainComposerEnterBehavior('none', 0)).toBe(true);
        expect(shouldUsePlainComposerEnterBehavior('none', 2)).toBe(true);
    });

    test('uses plain enter behavior for command mode with no matching suggestions', () => {
        expect(shouldUsePlainComposerEnterBehavior('command', 0)).toBe(true);
    });

    test('keeps suggestion handling when command suggestions are available', () => {
        expect(shouldUsePlainComposerEnterBehavior('command', 1)).toBe(false);
    });

    test('preserves existing mention behavior for empty file and refine suggestions', () => {
        expect(shouldUsePlainComposerEnterBehavior('file', 0)).toBe(false);
        expect(shouldUsePlainComposerEnterBehavior('refine', 0)).toBe(false);
    });
});
