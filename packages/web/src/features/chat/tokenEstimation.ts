/**
 * Offline, provider-agnostic token estimation for tool outputs.
 *
 * Numbers produced here are diagnostics: they approximate how many input
 * tokens a tool result will consume when it re-enters the model's context on
 * the following step. They are intentionally kept separate from the billed
 * usage totals reported by the provider (`totalInputTokens`, `totalTokens`,
 * ...) — always present them as estimates (e.g. with a `~` prefix).
 */

// On average, one token covers roughly 4 characters of prose-like text.
const DEFAULT_BYTES_PER_TOKEN = 4;

// Serialized JSON tokenizes far more densely: punctuation like braces,
// quotes, colons, and escape sequences tend to become single-character
// tokens, pushing the ratio down to roughly 2 characters per token. Using
// the prose ratio on JSON would systematically underestimate.
const JSON_BYTES_PER_TOKEN = 2;

export const estimateTokenCount = (content: string, bytesPerToken: number = DEFAULT_BYTES_PER_TOKEN): number => {
    return Math.round(content.length / bytesPerToken);
}

/**
 * Estimates the input-token footprint of a tool output.
 *
 * The output is measured in its serialized JSON form — the shape in which
 * it is sent back to the model as a tool result — so structural overhead is
 * included in the estimate, not just the human-readable payload.
 */
export const estimateToolOutputTokens = (output: unknown): number => {
    // JSON.stringify returns undefined (not a string) for undefined input.
    const serialized = JSON.stringify(output) ?? '';
    return estimateTokenCount(serialized, JSON_BYTES_PER_TOKEN);
}