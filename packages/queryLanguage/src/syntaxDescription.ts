/**
 * Human-readable description of the Sourcebot search query syntax.
 * Keep this in sync with query.grammar and tokens.ts when the syntax changes.
 */
export const SEARCH_SYNTAX_DESCRIPTION = `
# Sourcebot Search Query Syntax

Sourcebot uses a structured query language for searching code across repositories.

## Full-text search

Bare words and quoted strings search across file content:
  authentication           — matches files containing "authentication"
  "password reset"         — exact phrase match

Words can contain almost any character including slashes, dots, @-signs, and dashes.
For example, @aws-sdk/credential-providers and v1.2.3 are each treated as single terms.
A dash within a word (e.g. hello-world) is part of the word, not negation.

## Prefix filters

Narrow the search using prefix:value syntax. Values can be plain words or quoted strings.

  content:<value>   (alias: c:)       Match within file content
  file:<value>      (alias: f:)       Match file path
  lang:<value>                        Match programming language (see language names below)
  repo:<value>      (alias: r:)       Match repository name
  sym:<value>                         Match symbol or identifier name
  rev:<value>                         Match git revision or branch name
  context:<value>                     Match context
  reposet:<value>                     Match a named repository set
  archived:yes|no|only                Filter by archived status
  fork:yes|no|only                    Filter by fork status
  visibility:public|private|any       Filter by repository visibility

## Language names

Language names for lang: come from GitHub Linguist and are case-sensitive.
Common values:

  TypeScript   — .ts files
  TSX          — .tsx files (TypeScript + React/JSX)
  JavaScript   — .js and .jsx files
  Python
  Go
  Rust
  Java
  C
  C++
  Ruby
  Swift
  Kotlin
  CSS
  HTML
  JSON
  YAML
  Markdown
  Shell
  Scala
  Haskell
  Elixir
  Elm
  PHP
  Dart
  R
  Vue
  Svelte

When unsure of the exact language name, prefer using file: with a regex to match
file extensions instead (e.g. file:\\.tsx$ instead of lang:TSX).

## Quoting and spaces

Any term or filter value that contains spaces must be wrapped in double quotes.
Any double-quote characters within the quoted value must be escaped with a backslash (\").
This applies to bare search terms AND to filter values like content:, file:, repo:, etc.

  "password reset"           — bare term: phrase with a space
  content:"error handler"    — filter value with a space, no internal quotes

When the pattern itself contains double quotes (e.g. matching JSON or source code), escape
each internal quote with a backslash. Build it up in steps:

  Step 1 — raw pattern you want to match:   "next": "15.
  Step 2 — escape the internal quotes:       \"next\": \"15.
  Step 3 — wrap in outer double quotes:      "\"next\": \"15."
  Step 4 — full filter:                      content:"\"next\": \"15\\.\\d"

WRONG: content:""next": "15\.\d    ← unescaped internal quotes break the value boundary
RIGHT: content:"\"next\": \"15\\.\\d"

Every " inside a quoted value MUST become \". Missing even one will produce incorrect results.

## Filter value matching

file:, repo:, sym:, and rev: always treat their value as a regular expression.
A simple word matches as a case-sensitive substring; a full regex pattern can use
anchors, alternation, etc. No forward slashes are used:
  file:chat               — matches any path containing "chat"
  file:test               — matches any path containing "test"
  file:\\.tsx$            — matches paths ending in .tsx
  file:(test|spec)        — matches paths containing "test" or "spec"
  repo:myorg              — matches any repo name containing "myorg"
  sym:useState            — matches symbols containing "useState"

content: also treats its value as a regular expression:
  content:useState                       — matches files containing "useState"
  content:error.*handler                 — matches files where "error" appears before "handler"
  content:"\"next\": \"15\\.\\d"        — matches the literal text: "next": "15.<digit>

IMPORTANT: Regex flags (such as /i for case-insensitive) are NOT supported.
All matching is case-sensitive. Do not wrap values in forward slashes for
file:, repo:, sym:, or rev: — the value itself is the pattern.

## Boolean logic

Space (AND):    Terms separated by spaces are ANDed — all must match.

or keyword:     Use or between terms or filter expressions (must be lowercase).
                NOTE: or must not appear at the start or end of a query, and must
                be followed by at least one more term.
                Correct:   auth or login
                Incorrect: auth OR login  /  or login  /  auth or

Negation (-):   Prefix a filter or parenthesized group with - to exclude it.
                NOTE: - only negates a prefix filter (e.g. -file:test) or a
                parenthesized group (-(...)). A dash inside a word like hello-world
                is NOT negation.
                Correct:   -file:test  -(file:test or file:spec)
                Incorrect: -hello      -"some phrase"

## Grouping

Use parentheses to group expressions:
  (auth or login) lang:TypeScript
  -(file:test or file:spec)

NOTE: Parentheses must be balanced to be treated as grouping. An unbalanced (
is treated as part of the adjacent word.

## Examples

  authentication lang:TypeScript
    → .ts files containing "authentication"

  content:useState lang:TSX
    → .tsx (React) files using useState

  content:"password reset" -file:test
    → Files with the phrase "password reset", excluding test files

  sym:useState lang:TypeScript
    → TypeScript files using the useState symbol

  repo:myorg/frontend file:package.json content:@aws-sdk
    → package.json files in the myorg/frontend repo mentioning @aws-sdk

  (content:authenticate or content:login) -lang:Markdown
    → Non-markdown files with authentication or login code

  content:@aws-sdk/credential-providers file:package.json content:["']3\\.\\d
    → package.json files referencing @aws-sdk/credential-providers at a 3.x version

  file:package\\.json content:"\"next\": \"15\\.\\d"
    → package.json files with next pinned to a 15.x version (note escaped inner quotes)

  file:package\\.json content:"\"next-auth\": \"\\^?5\\."
    → package.json files with next-auth at a 5.x version

  file:package\\.json content:"\"react\": \""
    → package.json files that have a react dependency (any version)

  file:package\\.json content:"\"(stripe|openai)\": \""
    → package.json files with stripe or openai as a dependency

  file:package\\.json content:"\"[a-z-]+\": \"\\^?(0\\.|[1-9]\\d*\\.)"
    → package.json files with any dependency at a semver version

  file:package\\.json content:"\"next\": \"\\^?(1[0-5]|[1-9])\\."
    → package.json files with next at version 15 or lower

  lang:TypeScript content:"from \"react\""
    → TypeScript files that import from react

  lang:TypeScript content:"from \"(react|react-dom)\""
    → TypeScript files that import from react or react-dom
`.trim();
