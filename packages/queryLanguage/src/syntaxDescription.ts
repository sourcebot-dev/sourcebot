/**
 * LLM-readable description of the Sourcebot search query syntax.
 * Keep this in sync with query.grammar and tokens.ts when the syntax changes.
 */
export const SEARCH_SYNTAX_DESCRIPTION = String.raw`
# Sourcebot Search Query Syntax

## Search terms

Bare words search across file content and are interpreted as case-sensitive regular expressions:
  useState                 — matches files containing "useState"
  useS?tate                — matches files containing "useState" or "usetate"
  ^import                  — matches lines beginning with "import"
  error.*handler           — matches "error" followed by "handler" on the same line

Wrap terms in double quotes to match a phrase with spaces:
  "password reset"         — matches files containing the phrase "password reset"

## Filters

Narrow searches with prefix:value syntax:

  file:<value>      — filter by file path
  lang:<value>      — filter by language. Uses linguist language definitions (e.g. TypeScript, Python, Go, Rust, Java)
  repo:<value>      — filter by repository name
  sym:<value>       — filter by symbol name
  rev:<value>       — filter by git branch or tag

All filter values are interpreted as case-sensitive regular expressions.
A plain word matches as a substring. No forward slashes around values.

## Boolean logic

Space = AND. All space-separated terms must match.
  useState lang:TypeScript         — TypeScript files containing useState

or = OR (must be lowercase, not at start/end of query).
  auth or login                    — files containing "auth" or "login"

- = negation. Only valid before a filter or a parenthesized group.
  -file:test                       — exclude paths matching /test/
  -(file:test or file:spec)        — exclude test and spec files

## Grouping

Parentheses group expressions:
  (auth or login) lang:TypeScript
  -(file:test or file:spec)

## Quoting

Wrap a value in double quotes when it contains spaces:
  "password reset"
  "error handler"

When the quoted value itself contains double-quote characters, escape each one as \":
  "\"key\": \"value\""     — matches the literal text: "key": "value"

For unquoted values, escape regex metacharacters with a single backslash:
  file:package\.json               — matches literal "package.json"

## Examples

Input: find all TODO comments
Output: //\s*TODO

Input: find TypeScript files that use useState
Output: lang:TypeScript useState

Input: find files that import from react
Output: lang:TypeScript "from \"react\""

Input: find all test files
Output: file:(test|spec)

Input: find all API route handlers
Output: file:route\.(ts|js)$

Input: find package.json files that depend on react
Output: file:package\.json "\"react\": \""

Input: find package.json files with beta or alpha dependencies
Output: file:package\.json "\"[^\"]+\": \"[^\"]*-(beta|alpha)"

Input: find package.json files where next is pinned to version 15
Output: file:package\.json "\"next\": \"\\^?15\\."

Input: find next versions less than 15
Output: file:package\.json "\"next\": \"\^?(1[0-4]|[1-9])\."

Input: find log4j versions 2.3.x or lower
Output: file:package\.json "\"log4j\": \"\^?2\.([0-2]|3)\."

Input: find TypeScript files that import from react or react-dom
Output: lang:TypeScript "from \"(react|react-dom)\""

Input: find files with password reset logic, excluding tests
Output: "password reset" -file:test
`.trim();
