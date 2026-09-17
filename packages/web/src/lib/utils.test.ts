import { afterEach, describe, expect, test, vi } from 'vitest';
import { measure, measureSync } from './utils';

describe('performance measurement utilities', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('measureSync preserves timeline entries without relying on the measure return value', () => {
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(100)
            .mockReturnValueOnce(112.5);
        const markSpy = vi.spyOn(performance, 'mark');
        const measureSpy = vi.spyOn(performance, 'measure')
            .mockImplementation(() => undefined as unknown as PerformanceMeasure);

        const result = measureSync(() => 'result', 'sync-operation', false);

        expect(result).toEqual({
            data: 'result',
            durationMs: 12.5,
        });
        expect(markSpy).toHaveBeenNthCalledWith(1, 'sync-operation.start');
        expect(markSpy).toHaveBeenNthCalledWith(2, 'sync-operation.end');
        expect(measureSpy).toHaveBeenCalledWith(
            'sync-operation',
            'sync-operation.start',
            'sync-operation.end',
        );
    });

    test('measure preserves timeline entries without relying on the measure return value', async () => {
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(50)
            .mockReturnValueOnce(75);
        const markSpy = vi.spyOn(performance, 'mark');
        const measureSpy = vi.spyOn(performance, 'measure')
            .mockImplementation(() => undefined as unknown as PerformanceMeasure);

        const result = await measure(async () => 'result', 'async-operation', false);

        expect(result).toEqual({
            data: 'result',
            durationMs: 25,
        });
        expect(markSpy).toHaveBeenNthCalledWith(1, 'async-operation.start');
        expect(markSpy).toHaveBeenNthCalledWith(2, 'async-operation.end');
        expect(measureSpy).toHaveBeenCalledWith(
            'async-operation',
            'async-operation.start',
            'async-operation.end',
        );
    });

    test('ignores performance timeline instrumentation failures', () => {
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(10)
            .mockReturnValueOnce(15);
        vi.spyOn(performance, 'mark').mockImplementation(() => {
            throw new Error('Performance timeline unavailable');
        });
        vi.spyOn(performance, 'measure').mockImplementation(() => {
            throw new Error('Performance timeline unavailable');
        });

        expect(measureSync(() => 'result', 'operation', false)).toEqual({
            data: 'result',
            durationMs: 5,
        });
    });

    test('measure ignores performance timeline instrumentation failures', async () => {
        vi.spyOn(performance, 'now')
            .mockReturnValueOnce(20)
            .mockReturnValueOnce(27.5);
        vi.spyOn(performance, 'mark').mockImplementation(() => {
            throw new Error('Performance timeline unavailable');
        });
        vi.spyOn(performance, 'measure').mockImplementation(() => {
            throw new Error('Performance timeline unavailable');
        });

        await expect(measure(async () => 'async result', 'async-operation', false)).resolves.toEqual({
            data: 'async result',
            durationMs: 7.5,
        });
    });
});
