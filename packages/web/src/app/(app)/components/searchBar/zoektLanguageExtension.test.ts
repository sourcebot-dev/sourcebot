import { expect, test } from 'vitest';
import { zoekt } from './zoektLanguageExtension';

test('reuses the same language support across calls', () => {
    expect(zoekt()).toBe(zoekt());
});
