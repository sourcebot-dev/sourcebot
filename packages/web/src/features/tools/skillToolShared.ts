import { env } from "@sourcebot/shared";
import { ErrorCode } from "@/lib/errorCodes";
import type { AskSkillAnalyticsSource } from "@/lib/posthogEvents";
import type { ServiceError } from "@/lib/serviceError";
import { StatusCodes } from "http-status-codes";

// Helpers shared by the skill management tools (create_skill, update_skill,
// list_skills).

export const toSkillAnalyticsSource = (source: string | undefined): AskSkillAnalyticsSource =>
    source === 'sourcebot-mcp-server' || source === 'sourcebot-web-client'
        ? source
        : 'sourcebot-ask-agent';

// Repository-scoped access tokens grant access to selected repositories only;
// account-level skill management is outside their documented authorization
// boundary. Every skill tool rejects them in its handler regardless of
// registration-time gating: an MCP session is keyed by its owner, not its
// principal, so a session created with a full credential can later be driven
// by a scoped token for the same user.
export const scopedTokensCannotManageSkills = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "Repository-scoped access tokens cannot manage skills.",
});

// The settings page supports ?skill= deep links that open the given skill.
export const skillSettingsUrl = (skillId: string): string =>
    `${env.AUTH_URL.replace(/\/$/, '')}/settings/skills?skill=${encodeURIComponent(skillId)}`;

/**
 * Maps a ServiceError to the tool error both adapters surface to the model.
 * Validation, conflict, permission, and entitlement errors keep their
 * actionable messages; unexpected failures collapse to a generic message
 * (details are already logged server-side by `sew`).
 */
export const toSkillToolError = (
    error: ServiceError,
    { notAuthenticatedMessage, fallbackMessage }: { notAuthenticatedMessage: string; fallbackMessage: string },
): Error => {
    if (error.errorCode === ErrorCode.NOT_AUTHENTICATED) {
        return new Error(notAuthenticatedMessage);
    }
    if (error.errorCode === ErrorCode.UNEXPECTED_ERROR) {
        return new Error(fallbackMessage);
    }
    return new Error(error.message);
};
