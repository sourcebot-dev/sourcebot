import { expect, test } from 'vitest'
import { fileReferenceToString } from './utils'
import { FILE_REFERENCE_REGEX } from './constants';


test('fileReferenceToString formats file references correctly', () => {
    expect(fileReferenceToString({
        fileName: 'auth.ts'
    })).toBe('@file:{auth.ts}');

    expect(fileReferenceToString({
        fileName: 'auth.ts',
        range: {
            startLine: 45,
            endLine: 60,
        }
    })).toBe('@file:{auth.ts:45-60}');
});

test('fileReferenceToString matches FILE_REFERENCE_REGEX', () => {
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        fileName: 'auth.ts'
    }))).toBe(true);

    FILE_REFERENCE_REGEX.lastIndex = 0;
    expect(FILE_REFERENCE_REGEX.test(fileReferenceToString({
        fileName: 'auth.ts',
        range: {
            startLine: 45,
            endLine: 60,
        }
    }))).toBe(true);
});