import { expect, test } from 'vitest';
import { arraysEqualShallow, isRemotePath, excludeReposByName } from './utils';
import { Repository } from './types';

const testNames: string[] = [
  "abcdefg/zfmno/ioiwerj/fawdf",
  "abcdefg/zfmno/ioiwerj/werw",
  "abcdefg/zfmno/ioiwerj/terne",
  "abcdefg/zfmno/ioiwerj/asdf45e4r",
  "abcdefg/zfmno/ioiwerj/ddee",
  "abcdefg/zfmno/ioiwerj/ccdfeee",
  "abcdefg/zfmno/sadfaw",
  "abcdefg/zfmno/ioiwerj/wwe",
  "abcdefg/ieieiowowieu8383/ieckup-e",
  "abcdefg/ieieiowowieu8383/fvas-eer-wwwer3"
];

const createRepository = (name: string) => (<Repository>{
  vcs: 'git',
  id: name,
  name: name,
  path: name,
  isStale: false,
  cloneUrl: name,
  branches: [name],
  tags: [name]
});

test('should filter repos by micromatch pattern', () => {
  // bad glob patterns
  const unfilteredRepos = excludeReposByName(testNames.map(n => (createRepository(n))), ['/zfmno/']);
  expect(unfilteredRepos.length).toBe(10);
  expect(unfilteredRepos.map(r => r.name)).toEqual(testNames);
  const unfilteredRepos1 = excludeReposByName(testNames.map(n => (createRepository(n))), ['**zfmno**']);
  expect(unfilteredRepos1.length).toBe(10);
  expect(unfilteredRepos1.map(r => r.name)).toEqual(testNames);

  // good glob patterns
  const filteredRepos = excludeReposByName(testNames.map(n => (createRepository(n))), ['**/zfmno/**']);
  expect(filteredRepos.length).toBe(2);
  expect(filteredRepos.map(r => r.name)).toEqual(["abcdefg/ieieiowowieu8383/ieckup-e", "abcdefg/ieieiowowieu8383/fvas-eer-wwwer3"]);
  const filteredRepos1 = excludeReposByName(testNames.map(n => (createRepository(n))), ['**/*fmn*/**']);
  expect(filteredRepos1.length).toBe(2);
  expect(filteredRepos1.map(r => r.name)).toEqual(["abcdefg/ieieiowowieu8383/ieckup-e", "abcdefg/ieieiowowieu8383/fvas-eer-wwwer3"]);
});

test('should filter repos by name exact match', () => {
  const filteredRepos = excludeReposByName(testNames.map(n => (createRepository(n))), testNames.slice(1, 9));
  expect(filteredRepos.length).toBe(2);
  expect(filteredRepos.map(r => r.name)).toEqual([testNames[0], testNames[9]]);

  const filteredRepos1 = excludeReposByName(testNames.map(n => (createRepository(n))), testNames.slice(3, 5));
  expect(filteredRepos1.length).toBe(8);
  expect(filteredRepos1.map(r => r.name)).toEqual([testNames[0], testNames[1], testNames[2], testNames[5], testNames[6], testNames[7], testNames[8], testNames[9]]);

  const filteredRepos2 = excludeReposByName(testNames.map(n => (createRepository(n))), [testNames[0], testNames[7], testNames[9]]);
  expect(filteredRepos2.length).toBe(7);
  expect(filteredRepos2.map(r => r.name)).toEqual([...testNames.slice(1, 7), testNames[8]]);
});

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
