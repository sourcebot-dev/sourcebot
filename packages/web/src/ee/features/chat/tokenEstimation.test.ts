import { describe, expect, it } from 'vitest';
import { estimateModelToolOutputTokens, estimateToolOutputTokens } from './tokenEstimation';

describe('estimateToolOutputTokens', () => {
    it('measures the serialized JSON form', () => {
        const output = { output: 'a'.repeat(100) };
        // {"output":"aaa...a"} -> 113 chars / 2 bytes per token
        expect(estimateToolOutputTokens(output)).toBe(Math.round(113 / 2));
    });

    it('handles undefined output', () => {
        expect(estimateToolOutputTokens(undefined)).toBe(0);
    });
});

describe('estimateModelToolOutputTokens', () => {
    it('measures text variants', () => {
        expect(estimateModelToolOutputTokens({
            type: 'text',
            value: 'a'.repeat(100),
        })).toBe(50);
    });

    it('measures json variants, excluding the wrapper', () => {
        expect(estimateModelToolOutputTokens({
            type: 'json',
            value: { result: 'a'.repeat(100) },
        })).toBe(Math.round(113 / 2));
    });

    it('sums the text parts of content variants', () => {
        expect(estimateModelToolOutputTokens({
            type: 'content',
            value: [
                { type: 'text', text: 'a'.repeat(100) },
                { type: 'text', text: 'b'.repeat(100) },
            ],
        })).toBe(100);
    });

    it('only counts the model-visible text of a mapped tool result', () => {
        // Mirrors toVercelAITool's `toModelOutput`: the model sees only the
        // `output` string; UI-only metadata must not inflate the estimate.
        const text = 'Found 3 matches in 2 files';
        const estimate = estimateModelToolOutputTokens({
            type: 'content',
            value: [{ type: 'text', text }],
        });
        expect(estimate).toBe(Math.round(text.length / 2));
    });
});