import { z } from "zod";

/**
 * Spec for the per-user "Chat Preferences" feature.
 *
 * Each dimension is a multiple-choice axis the user can set on the Settings >
 * Chat Preferences page. The selected value is appended as a soft bias to the
 * agent's system prompt via `renderChatPreferencesPromptBlock`. A value of
 * `undefined` (i.e. the dimension is absent from the persisted object) means
 * the user has not expressed a preference and the agent should fall back to
 * its default behavior for that axis.
 *
 * To add a new dimension: add an entry below and the rest of the system
 * (zod schema, UI rendering, prompt block) updates automatically.
 */
export const CHAT_PREFERENCE_SPEC = {
    depth: {
        label: "Depth",
        description: "How deep should the answer go?",
        levels: [
            {
                value: "full_detail",
                label: "Full detail",
                promptHint: "Provide deep, comprehensive answers with full implementation detail.",
            },
            {
                value: "concept_level",
                label: "Concept-level",
                promptHint: "Keep answers at the concept level. Avoid implementation detail unless the user explicitly asks for it.",
            },
            {
                value: "one_paragraph",
                label: "One-paragraph summary",
                promptHint: "Keep answers brief. Aim for a single paragraph that summarizes the key points.",
            },
        ],
    },
    codeVisibility: {
        label: "Code visibility",
        description: "How much real code should appear in answers?",
        levels: [
            {
                value: "show_full",
                label: "Show full snippets",
                promptHint: "Include complete, runnable code snippets where they aid the explanation.",
            },
            {
                value: "show_minimal",
                label: "Show minimal code",
                promptHint: "Include only the essential lines of code. Trim or summarize surrounding boilerplate.",
            },
            {
                value: "describe_only",
                label: "Skip code, describe it",
                promptHint: "Avoid showing source code. Describe what the code does in plain language instead.",
            },
        ],
    },
    vocabulary: {
        label: "Vocabulary",
        description: "How technical should the language be?",
        levels: [
            {
                value: "jargon_ok",
                label: "Jargon OK",
                promptHint: "Use technical terms and acronyms freely. Assume a technical reader.",
            },
            {
                value: "define_terms",
                label: "Define terms",
                promptHint: "Define technical terms on first use. Avoid unexplained acronyms.",
            },
            {
                value: "business_framing",
                label: "Business framing",
                promptHint: "Frame answers around business impact and outcomes. Minimize implementation jargon.",
            },
        ],
    },
    citationDensity: {
        label: "Citation density",
        description: "How often should answers cite source files?",
        levels: [
            {
                value: "every_claim",
                label: "Every claim",
                promptHint: "Cite the relevant source file for every factual claim about the codebase.",
            },
            {
                value: "key_claims",
                label: "Key claims",
                promptHint: "Cite source files for the key claims, not every minor detail.",
            },
            {
                value: "sources_at_end",
                label: "Sources at the end",
                promptHint: "List the relevant source files at the end of the answer rather than citing inline.",
            },
        ],
    },
    outputStructure: {
        label: "Output structure",
        description: "How should answers be formatted?",
        levels: [
            {
                value: "headers_bullets",
                label: "Headers + bullets + code",
                promptHint: "Use markdown headers, bullet lists, and code blocks to structure the answer.",
            },
            {
                value: "plain_prose",
                label: "Plain prose + bullets",
                promptHint: "Prefer plain prose with light use of bullet lists. Avoid heavy markdown structure.",
            },
            {
                value: "tldr_three_points",
                label: "TL;DR + 3 key points",
                promptHint: "Lead with a one-sentence TL;DR followed by up to 3 key points. Keep it short.",
            },
        ],
    },
    diagrams: {
        label: "Diagrams",
        description: "How often should answers include diagrams?",
        levels: [
            {
                value: "when_useful",
                label: "When useful",
                promptHint: "Include a diagram only when it meaningfully aids understanding.",
            },
            {
                value: "often",
                label: "Often",
                promptHint: "Bias toward including a diagram when the topic involves flows, sequences, or structures.",
            },
            {
                value: "almost_always",
                label: "Almost always (visual-first)",
                promptHint: "Lead with a diagram whenever possible. Treat visualizations as a first-class part of the answer.",
            },
        ],
    },
} as const;

export type ChatPreferenceDimension = keyof typeof CHAT_PREFERENCE_SPEC;

type LevelValueFor<D extends ChatPreferenceDimension> =
    typeof CHAT_PREFERENCE_SPEC[D]["levels"][number]["value"];

export const CHAT_PREFERENCE_DIMENSIONS = Object.keys(CHAT_PREFERENCE_SPEC) as ChatPreferenceDimension[];

/**
 * Build a zod object schema whose shape is derived from {@link CHAT_PREFERENCE_SPEC}.
 * Each dimension is an optional enum of its level values, and unknown keys are
 * rejected (`.strict()`) so we never persist garbage to the JSONB column.
 */
const buildChatPreferencesSchema = () => {
    const shape = {} as Record<ChatPreferenceDimension, z.ZodOptional<z.ZodEnum<[string, ...string[]]>>>;
    for (const dimension of CHAT_PREFERENCE_DIMENSIONS) {
        const levelValues = CHAT_PREFERENCE_SPEC[dimension].levels.map((l) => l.value);
        shape[dimension] = z.enum(levelValues as [string, ...string[]]).optional();
    }
    return z.object(shape).strict();
};

export const chatPreferencesSchema = buildChatPreferencesSchema();

export type ChatPreferences = {
    [D in ChatPreferenceDimension]?: LevelValueFor<D>;
};

export const CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH = 1000;

export const chatCustomInstructionsSchema = z
    .string()
    .max(CHAT_CUSTOM_INSTRUCTIONS_MAX_LENGTH)
    .nullable();

/**
 * Full payload accepted by the `updateChatPreferences` server action.
 */
export const updateChatPreferencesInputSchema = z.object({
    preferences: chatPreferencesSchema,
    customInstructions: chatCustomInstructionsSchema,
});

export type UpdateChatPreferencesInput = z.infer<typeof updateChatPreferencesInputSchema>;

/**
 * Renders the `<user_preferences>` block that gets appended to the agent's
 * system prompt. Returns `null` when the user has no preferences set and no
 * custom instructions, so callers can cleanly omit the block.
 *
 * Soft-bias framing is intentional: preferences must never override
 * correctness or the explicit content of the user's most recent message.
 */
export const renderChatPreferencesPromptBlock = ({
    preferences,
    customInstructions,
}: {
    preferences: ChatPreferences;
    customInstructions: string | null;
}): string | null => {
    const hints: string[] = [];

    for (const dimension of CHAT_PREFERENCE_DIMENSIONS) {
        const value = preferences[dimension];
        if (!value) {
            continue;
        }
        const spec = CHAT_PREFERENCE_SPEC[dimension];
        const level = spec.levels.find((l) => l.value === value);
        if (level) {
            hints.push(`- **${spec.label}**: ${level.promptHint}`);
        }
    }

    const trimmedCustom = customInstructions?.trim();

    if (hints.length === 0 && !trimmedCustom) {
        return null;
    }

    const sections: string[] = [];

    if (hints.length > 0) {
        sections.push(
            "The user has expressed the following response-style preferences. Treat each one as a soft bias that shapes how you write the final answer. Never let these preferences override correctness, override an explicit instruction in the user's most recent message, or cause you to skip steps you would otherwise take.\n\n" +
                hints.join("\n"),
        );
    }

    if (trimmedCustom) {
        sections.push(
            "The user has provided the following custom instructions. Apply them when forming your final answer, again as soft guidance that does not override correctness or the explicit user message:\n\n" +
                `"${trimmedCustom}"`,
        );
    }

    return `<user_preferences>\n${sections.join("\n\n")}\n</user_preferences>`;
};
