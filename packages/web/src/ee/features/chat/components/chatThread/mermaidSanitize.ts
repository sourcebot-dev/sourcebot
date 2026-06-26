// Defensive cleanup applied to model-generated mermaid source before it is
// handed to `mermaid.parse()` / `mermaid.render()`. Kept as a standalone,
// dependency-free module so it can be unit tested without pulling in the
// (heavy, client-only) diagram component.

// Strip model-emitted custom styling so it can't override the auto-applied
// theme. Line-anchored on the keyword, so it leaves node IDs, labels, and
// `class X { ... }` member definitions untouched.
const STYLING_DIRECTIVE_RE = /^\s*(?:style|classDef|linkStyle)\s/;

// The model intermittently hallucinates the keyword `subgbox` (sometimes with a
// numeric suffix: `subgbox2`, `subgbox3`, ...) in place of a `subgraph <id>`
// opener, e.g. `subgbox["KV v2 Secrets Engine"]`. This single malformed token
// fails the entire parse. Rewrite it into a valid opener, reusing the garbled
// token as the (unique) subgraph id: `subgraph subgbox["KV v2 Secrets Engine"]`.
const HALLUCINATED_SUBGRAPH_OPENER_RE = /^(\s*)(subgbox\w*)(\s*[[(])/;

export const sanitizeMermaidCode = (code: string): string =>
    code
        .split('\n')
        .filter((line) => !STYLING_DIRECTIVE_RE.test(line))
        .map((line) => line.replace(HALLUCINATED_SUBGRAPH_OPENER_RE, '$1subgraph $2$3'))
        .join('\n');
