import { AgentConfig } from "@sourcebot/db";
import { env } from "@sourcebot/shared";
import { parseAgentConfigSettings } from "./app";

/**
 * Returns whether auto-review is enabled, checking (in priority order):
 *   1. Per-config setting (AgentConfig.settings.autoReviewEnabled)
 *   2. REVIEW_AGENT_AUTO_REVIEW_ENABLED env var (treated as true unless explicitly "false")
 */
export function isAutoReviewEnabled(config: AgentConfig | null): boolean {
    if (config) {
        const settings = parseAgentConfigSettings(config.settings);
        if (settings.autoReviewEnabled !== undefined) {
            return settings.autoReviewEnabled;
        }
    }
    return env.REVIEW_AGENT_AUTO_REVIEW_ENABLED !== "false";
}

/**
 * Returns the review command trigger string, checking (in priority order):
 *   1. Per-config setting (AgentConfig.settings.reviewCommand)
 *   2. REVIEW_AGENT_REVIEW_COMMAND env var
 */
export function getReviewCommand(config: AgentConfig | null): string {
    if (config) {
        const settings = parseAgentConfigSettings(config.settings);
        if (settings.reviewCommand) {
            return settings.reviewCommand;
        }
    }
    return env.REVIEW_AGENT_REVIEW_COMMAND;
}
