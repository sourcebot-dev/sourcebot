import { ToolResultOutput } from "@ai-sdk/provider-utils";

/**
 * Offline, provider-agnostic token estimation for tool outputs.
 *
 * Numbers produced here are diagnostics: they approximate how many input
 * tokens a tool result will consume when it re-enters the model's context on
 * the following step. They are intentionally kept separate from the billed
 * usage totals reported by the provider (`totalInputTokens`, `totalTokens`,
 * ...) — always present them as estimates (e.g. with a `~` prefix).
 */

// Empirically, ~2 characters per token tracks the true input-token cost of
// tool results when checked against provider-reported per-step usage. Tool
// outputs are dominated by token-dense content — source code, file paths,
// JSON — and re-enter the context wrapped in tool-call/result envelopes,
// pushing the effective ratio well below the ~4 chars/token typical of
// English prose. The dense ratio applies across the board: overestimating
// the occasional prose-heavy output is acceptable, while underestimating
// would let oversized results look small.
const ESTIMATED_BYTES_PER_TOKEN = 2;

export const estimateTokenCount = (content: string, bytesPerToken: number = ESTIMATED_BYTES_PER_TOKEN): number => {
    return Math.round(content.length / bytesPerToken);
}

/**
 * Estimates the input-token footprint of a tool output for tools WITHOUT a
 * `toModelOutput` mapping. The AI SDK sends such outputs to the model as a
 * serialized JSON object, so the estimate measures that form — structural
 * overhead included.
 *
 * For tools that define `toModelOutput`, use
 * {@link estimateModelToolOutputTokens} on the mapped result instead:
 * estimating the raw output object would count payload (e.g. UI-only
 * metadata) the model never sees.
 */
export const estimateToolOutputTokens = (output: unknown): number => {
    // JSON.stringify returns undefined (not a string) for undefined input.
    const serialized = JSON.stringify(output) ?? '';
    return estimateTokenCount(serialized);
}

/**
 * Estimates the input-token footprint of a `toModelOutput` result — the
 * payload that is actually sent back to the model as the tool result.
 */
export const estimateModelToolOutputTokens = (modelOutput: ToolResultOutput): number => {
    switch (modelOutput.type) {
        case 'text':
        case 'error-text':
            return estimateTokenCount(modelOutput.value);
        case 'json':
        case 'error-json':
            return estimateTokenCount(JSON.stringify(modelOutput.value) ?? '');
        case 'content':
            return modelOutput.value.reduce((sum, part) => {
                if (part.type === 'text') {
                    return sum + estimateTokenCount(part.text);
                }
                // Non-text parts (media, file references) have no meaningful
                // text length; fall back to their serialized size.
                return sum + estimateTokenCount(JSON.stringify(part) ?? '');
            }, 0);
        default:
            return estimateTokenCount(JSON.stringify(modelOutput) ?? '');
    }
}