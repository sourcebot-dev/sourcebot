import { expect, test } from 'vitest'
import { completeSuggestion, splitQuery } from './searchSuggestionsBox'

test('splitQuery returns a single element when the query is empty', () => {
    const { queryParts, cursorIndex } = splitQuery('', 0);
    expect(cursorIndex).toEqual(0);
    expect(queryParts).toEqual(['']);
});

test('splitQuery splits on spaces', () => {
    const query = String.raw`repo:^github\.com/example/example$ world`;
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

test('splitQuery correctly locates the cursor index given the cursor position (1)', () => {
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

test('splitQuery correctly locates the cursor index given the cursor position (2)', () => {
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

test('completeSuggestion can complete a empty query', () => {
    const suggestionQuery = ``;
    const query = ``;
    const suggestion = "hello";
    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: false,
        regexEscaped: false,
        cursorPosition: 0,
    });

    const expectedNewQuery = String.raw`hello`;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(newQuery.length);
});

test('completeSuggestion can complete with a empty suggestion query', () => {
    const suggestionQuery = ``;
    const query = `case:`;
    const suggestion = "auto";
    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: false,
        regexEscaped: false,
        cursorPosition: query.length,
    });

    const expectedNewQuery = `case:auto`;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(newQuery.length);
});

test('completeSuggestion inserts a trailing space when trailingSpace is true and the completion is at the end of the query', () => {
    const suggestionQuery = 'a';
    const part1 = String.raw`lang:Go`;
    const part2 = String.raw`case:${suggestionQuery}`;
    const query = `${part1} ${part2}`
    const suggestion = 'auto';
    const cursorPosition = query.length;

    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: true,
        regexEscaped: false,
        cursorPosition,
    });

    const expectedPart2 = `case:auto`
    const expectedNewQuery = `${part1} ${expectedPart2} `;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(newQuery.length);
});

test('completeSuggestion does not insert a trailing space when trailingSpace is true and the completion is not at the end of the query', () => {
    const suggestionQuery = 'G';
    const part1 = String.raw`lang:${suggestionQuery}`;
    const part2 = String.raw`case:auto`;
    const query = `${part1} ${part2}`
    const suggestion = 'Go';
    const cursorPosition = part1.length;

    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: true,
        regexEscaped: false,
        cursorPosition,
    });

    const expectedPart1 = `lang:Go`
    const expectedNewQuery = `${expectedPart1} ${part2}`; // Notice no trailing space
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(expectedPart1.length);
});

test('completeSuggestion wraps suggestions in quotes when the suggestion contains a space and regexEscaped is false', () => {
    const suggestionQuery = `m`;
    const query = `lang:${suggestionQuery}`;
    const suggestion = `my language`;
    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: false,
        regexEscaped: false,
        cursorPosition: query.length,
    });

    const expectedNewQuery = `lang:"my language"`;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(newQuery.length);
});

test('completeSuggestion completes on query parts that are inbetween other parts', () => {
    const part1 = String.raw`repo:^github\.com/sourcebot\x2ddev/sourcebot$`;
    const suggestionQuery = 'Type';
    const part2 = String.raw`lang:${suggestionQuery}`;
    const part3 = String.raw`case:auto`;
    const query = `${part1} ${part2} ${part3}`;
    const suggestion = 'TypeScript';
    const cursorPosition = ([part1, part2].join(" ").length);

    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery,
        suggestion,
        trailingSpace: false,
        regexEscaped: false,
        cursorPosition,
    });

    const expectedPart2 = "lang:TypeScript";
    const expectedNewQuery = String.raw`${part1} ${expectedPart2} ${part3}`;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe([part1, expectedPart2].join(" ").length);
});

test('completeSuggestions regex escapes suggestions when regexEscaped is true', () => {
    const query = "repo:github";
    const { newQuery, newCursorPosition } = completeSuggestion({
        query,
        suggestionQuery: "github",
        suggestion: "github.com/sourcebot-dev/sourcebot",
        trailingSpace: true,
        regexEscaped: true,
        cursorPosition: query.length,
    });

    const expectedNewQuery = String.raw`repo:^github\.com/sourcebot\x2ddev/sourcebot$ `;
    expect(newQuery).toEqual(expectedNewQuery);
    expect(newCursorPosition).toBe(newQuery.length);
});
