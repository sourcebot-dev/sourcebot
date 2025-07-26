import { expect, test } from 'vitest';
import { arraysEqualShallow } from './utils';
import { isRemotePath } from '@sourcebot/shared';

test('should return true for identical arrays', () => {
    expect(arraysEqualShallow([1, 2, 3], [1, 2, 3])).toBe(true);
});

test('should return true for empty arrays', () => {
    expect(arraysEqualShallow([], [])).toBe(true);
});

test('should return true for same array reference', () => {
    const arr = [1, 2, 3];
    expect(arraysEqualShallow(arr, arr)).toBe(true);
});

test('should return false when one array is undefined', () => {
    expect(arraysEqualShallow([1, 2, 3], undefined)).toBe(false);
    expect(arraysEqualShallow(undefined, [1, 2, 3])).toBe(false);
});

test('should return false for arrays with different lengths', () => {
    expect(arraysEqualShallow([1, 2], [1, 2, 3])).toBe(false);
});

test('should return true for arrays with same elements in different order', () => {
    expect(arraysEqualShallow([1, 2, 3], [3, 2, 1])).toBe(true);
});

test('should return false for arrays with different elements', () => {
    expect(arraysEqualShallow([1, 2, 3], [1, 2, 4])).toBe(false);
});

test('should handle arrays with string elements', () => {
    expect(arraysEqualShallow(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(arraysEqualShallow(['a', 'b'], ['a', 'c'])).toBe(false);
});

test('should handle arrays with duplicate elements', () => {
    expect(arraysEqualShallow([1, 1, 2], [1, 2, 1])).toBe(true);
    expect(arraysEqualShallow([1, 1], [1])).toBe(false);
    expect(arraysEqualShallow([1, 2, 2], [1, 1, 2])).toBe(false);
});

test('should not mutate the array', () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    expect(arraysEqualShallow(a, b)).toBe(true);
    expect(a[0]).toBe(1);
    expect(a[1]).toBe(2);
    expect(a[2]).toBe(3);
    expect(b[0]).toBe(3);
    expect(b[1]).toBe(2);
    expect(b[2]).toBe(1);
});

test('isRemotePath should return true for HTTP or HTTPS URLs', () => {
    expect(isRemotePath('https://example.com')).toBe(true);
    expect(isRemotePath('https://github.com/repo')).toBe(true);
    expect(isRemotePath('http://example.com')).toBe(true);
    expect(isRemotePath('http://localhost:3000')).toBe(true);
});

test('isRemotePath should return false for non HTTP paths', () => {
    expect(isRemotePath('/usr/local/bin')).toBe(false);
    expect(isRemotePath('./relative/path')).toBe(false);
    expect(isRemotePath('C:\\Windows\\System32')).toBe(false);
    expect(isRemotePath('')).toBe(false);
    expect(isRemotePath('   ')).toBe(false);
});
