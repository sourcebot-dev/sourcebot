import { describe, expect, test } from 'vitest';
import { parseGitAttributes, resolveLanguageFromGitAttributes } from './gitattributes';

describe('resolveLanguageFromGitAttributes', () => {
    test('a pattern without a slash matches files in any directory', () => {
        const attrs = parseGitAttributes('*.h linguist-language=C\n');

        expect(resolveLanguageFromGitAttributes('foo.h', attrs)).toBe('C');
        expect(resolveLanguageFromGitAttributes('src/include/foo.h', attrs)).toBe('C');
    });

    test('a pattern with a leading slash is anchored to the repository root', () => {
        const attrs = parseGitAttributes('/config.in linguist-language=Makefile\n');

        expect(resolveLanguageFromGitAttributes('config.in', attrs)).toBe('Makefile');
        expect(resolveLanguageFromGitAttributes('sub/config.in', attrs)).toBeUndefined();
    });

    test('a pattern with an inner slash is matched relative to the repository root', () => {
        const attrs = parseGitAttributes('docs/*.txt linguist-language=Markdown\n');

        expect(resolveLanguageFromGitAttributes('docs/intro.txt', attrs)).toBe('Markdown');
        expect(resolveLanguageFromGitAttributes('other/docs/intro.txt', attrs)).toBeUndefined();
    });

    test('the last matching rule wins', () => {
        const attrs = parseGitAttributes('*.inc linguist-language=PHP\nlegacy/*.inc linguist-language=Pascal\n');

        expect(resolveLanguageFromGitAttributes('src/a.inc', attrs)).toBe('PHP');
        expect(resolveLanguageFromGitAttributes('legacy/a.inc', attrs)).toBe('Pascal');
    });
});
