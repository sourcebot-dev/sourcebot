import { expect, test } from 'vitest'
import { splitQuery } from './searchSuggestionsBox'

test('splitQuery returns a single element when the query is empty', () => {
    const { queryParts, cursorIndex } = splitQuery('', 0);
    expect(cursorIndex).toEqual(0);
    expect(queryParts).toEqual(['']);
});

test('splitQuery splits on spaces', () => {
    const query = "repo:^github\.com/example/example$ world";
    const { queryParts, cursorIndex } = splitQuery(query, 0);
    expect(queryParts).toEqual(query.split(" "));
    expect(cursorIndex).toEqual(0);
});

test('splitQuery groups parts that are in the same quote capture group into a single part', () => {
    const part1 = 'lang:"1C Enterprise"';
    const part2 = "hello";
    const { queryParts, cursorIndex } = splitQuery(`${part1} ${part2}`, 12);
    expect(queryParts).toEqual([part1, part2]);
    expect(cursorIndex).toEqual(0);
});

test('splitQuery does not support nested quote capture groups', () => {
    const { queryParts } = splitQuery('lang:"My language "with quotes"" hello', 0);
    expect(queryParts).toEqual(['lang:"My language "with', 'quotes""', 'hello']);
});

test('splitQuery groups all parts together when a quote capture group is not closed', () => {
    const query = '"hello asdf ok'
    const { queryParts, cursorIndex } = splitQuery(query, 0);
    expect(queryParts).toEqual([query]);
    expect(cursorIndex).toBe(0);
});

test('splitQuery correclty locates the cursor index given the cursor position (1)', () => {
    const query = 'foo bar "fizz buzz"';

    const { queryParts: parts1, cursorIndex: index1 } = splitQuery(query, 0);
    expect(parts1).toEqual(['foo', 'bar', '"fizz buzz"']);
    expect(parts1[index1]).toBe('foo');

    const { queryParts: parts2, cursorIndex: index2 } = splitQuery(query, 6);
    expect(parts2).toEqual(['foo', 'bar', '"fizz buzz"']);
    expect(parts2[index2]).toBe('bar');

    const { queryParts: parts3, cursorIndex: index3 } = splitQuery(query, 15);
    expect(parts3).toEqual(['foo', 'bar', '"fizz buzz"']);
    expect(parts3[index3]).toBe('"fizz buzz"');
});

test('splitQuery correclty locates the cursor index given the cursor position (2)', () => {
    const query = 'a b';
    expect(splitQuery(query, 0).cursorIndex).toBe(0);
    expect(splitQuery(query, 1).cursorIndex).toBe(0);
    expect(splitQuery(query, 2).cursorIndex).toBe(1);
    expect(splitQuery(query, 3).cursorIndex).toBe(1);
});

test('splitQuery can handle multiple spaces adjacent', () => {
    expect(splitQuery("a   b  ", 0).queryParts).toEqual(['a', '', '', 'b', '', '']);
});

test('splitQuery locates the cursor index to the last query part when the cursor position is at the end of the query', () => {
    const query = "as df";
    const cursorPos = query.length;
    const { queryParts, cursorIndex } = splitQuery(query, cursorPos);
    expect(cursorIndex).toBe(queryParts.length - 1);
    expect(queryParts[cursorIndex]).toBe("df");
    expect(queryParts).toEqual(['as', 'df']);
});

test('splitQuery sets the cursor index to 0 when the cursor position is out of bounds', () => {
    const query = "hello world";
    const cursorPos = query.length + 1;
    const { queryParts, cursorIndex } = splitQuery(query, cursorPos);
    expect(cursorIndex).toBe(0);
    expect(queryParts[cursorIndex]).toBe("hello");
    expect(queryParts).toEqual(['hello', 'world']);
});