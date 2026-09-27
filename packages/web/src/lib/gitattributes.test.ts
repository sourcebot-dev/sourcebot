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
        expect(resolveLanguageFromGitAttributes('./docs/intro.txt', attrs)).toBe('Markdown');
        expect(resolveLanguageFromGitAttributes('other/docs/intro.txt', attrs)).toBeUndefined();
    });

    test('the last matching rule wins', () => {
        const attrs = parseGitAttributes('*.inc linguist-language=PHP\nlegacy/*.inc linguist-language=Pascal\n');

        expect(resolveLanguageFromGitAttributes('src/a.inc', attrs)).toBe('PHP');
        expect(resolveLanguageFromGitAttributes('legacy/a.inc', attrs)).toBe('Pascal');
    });

    test('dotfiles match slashless patterns', () => {
        const attrs = parseGitAttributes('*.conf linguist-language=TOML\n');

        expect(resolveLanguageFromGitAttributes('src/.config.conf', attrs)).toBe('TOML');
    });

    test.each(['-linguist-language', '!linguist-language'])('%s clears the previous language override', (reset) => {
        const attrs = parseGitAttributes(`*.inc linguist-language=PHP\nlegacy/*.inc ${reset}\n`);

        expect(resolveLanguageFromGitAttributes('legacy/a.inc', attrs)).toBeUndefined();
    });

    test('a later language value replaces a reset', () => {
        const attrs = parseGitAttributes(
            '*.inc linguist-language=PHP\nlegacy/*.inc -linguist-language\nlegacy/special.inc linguist-language=Pascal\n',
        );

        expect(resolveLanguageFromGitAttributes('legacy/special.inc', attrs)).toBe('Pascal');
    });
});
