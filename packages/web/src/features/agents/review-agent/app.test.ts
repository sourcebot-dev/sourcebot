import { expect, test, vi, describe } from 'vitest';
import { parseAgentConfigSettings, resolveRules } from './app';
import { AgentConfig, AgentScope, AgentType, PromptMode } from '@sourcebot/db';

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    env: {
        REVIEW_AGENT_LOGGING_ENABLED: false,
    },
}));

// The nodes are not exercised by these unit tests — mock them to avoid loading
// their transitive dependencies (LLM SDKs, file-system access, etc.).
vi.mock('@/features/agents/review-agent/nodes/generatePrReview', () => ({ generatePrReviews: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/githubPushPrReviews', () => ({ githubPushPrReviews: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/githubPrParser', () => ({ githubPrParser: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/invokeDiffReviewLlm', () => ({ getReviewAgentLogDir: vi.fn(() => '/tmp'), invokeDiffReviewLlm: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/gitlabMrParser', () => ({ gitlabMrParser: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/gitlabPushMrReviews', () => ({ gitlabPushMrReviews: vi.fn() }));

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
    return {
        id: 'cfg-1',
        orgId: 1,
        name: 'test-config',
        description: null,
        type: AgentType.CODE_REVIEW,
        enabled: true,
        prompt: null,
        promptMode: PromptMode.APPEND,
        scope: AgentScope.ORG,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

// ─── parseAgentConfigSettings ────────────────────────────────────────────────

describe('parseAgentConfigSettings', () => {
    test('returns an empty object for empty settings', () => {
        expect(parseAgentConfigSettings({})).toEqual({});
    });

    test('parses all recognised fields', () => {
        const result = parseAgentConfigSettings({
            autoReviewEnabled: false,
            reviewCommand: 'check',
            model: 'claude-sonnet-4-6',
            contextFiles: 'AGENTS.md .sourcebot/review.md',
        });

        expect(result).toEqual({
            autoReviewEnabled: false,
            reviewCommand: 'check',
            model: 'claude-sonnet-4-6',
            contextFiles: 'AGENTS.md .sourcebot/review.md',
        });
    });

    test('parses a subset of fields', () => {
        expect(parseAgentConfigSettings({ model: 'gpt-4o' })).toEqual({ model: 'gpt-4o' });
    });

    test('returns empty object for a non-object value and does not throw', () => {
        expect(parseAgentConfigSettings("invalid")).toEqual({});
        expect(parseAgentConfigSettings(42)).toEqual({});
        expect(parseAgentConfigSettings(null)).toEqual({});
        expect(parseAgentConfigSettings(undefined)).toEqual({});
    });

    test('strips unknown fields', () => {
        const result = parseAgentConfigSettings({ model: 'x', unknownField: true, another: 123 });

        expect(result).not.toHaveProperty('unknownField');
        expect(result).not.toHaveProperty('another');
        expect(result).toEqual({ model: 'x' });
    });

    test('autoReviewEnabled accepts false explicitly', () => {
        const result = parseAgentConfigSettings({ autoReviewEnabled: false });

        expect(result.autoReviewEnabled).toBe(false);
    });
});

// ─── resolveRules ─────────────────────────────────────────────────────────────

describe('resolveRules', () => {
    test('returns default rules when config is null', () => {
        const rules = resolveRules(null);

        expect(rules.length).toBeGreaterThan(0);
        expect(rules.some(r => r.includes('Do NOT provide general feedback'))).toBe(true);
    });

    test('returns default rules when config has no prompt', () => {
        const rules = resolveRules(makeConfig({ prompt: null }));

        expect(rules.some(r => r.includes('Do NOT provide general feedback'))).toBe(true);
    });

    test('returns default rules when config has an empty string prompt', () => {
        const rules = resolveRules(makeConfig({ prompt: '' }));

        expect(rules.some(r => r.includes('Do NOT provide general feedback'))).toBe(true);
    });

    test('APPEND mode places the custom prompt after the default rules', () => {
        const rules = resolveRules(makeConfig({
            prompt: 'Flag any use of eval().',
            promptMode: PromptMode.APPEND,
        }));

        expect(rules[rules.length - 1]).toBe('Flag any use of eval().');
        expect(rules.some(r => r.includes('Do NOT provide general feedback'))).toBe(true);
    });

    test('APPEND mode does not remove any default rules', () => {
        const defaultRules = resolveRules(null);
        const appendRules = resolveRules(makeConfig({
            prompt: 'Extra rule.',
            promptMode: PromptMode.APPEND,
        }));

        expect(appendRules).toHaveLength(defaultRules.length + 1);
        defaultRules.forEach(rule => {
            expect(appendRules).toContain(rule);
        });
    });

    test('REPLACE mode returns only the custom prompt as a single rule', () => {
        const rules = resolveRules(makeConfig({
            prompt: 'Only this rule.',
            promptMode: PromptMode.REPLACE,
        }));

        expect(rules).toEqual(['Only this rule.']);
    });

    test('REPLACE mode discards all default rules', () => {
        const rules = resolveRules(makeConfig({
            prompt: 'Custom only.',
            promptMode: PromptMode.REPLACE,
        }));

        expect(rules.some(r => r.includes('Do NOT provide general feedback'))).toBe(false);
    });

    test('REPLACE mode with a multi-line prompt keeps it as a single entry', () => {
        const prompt = 'Rule one.\nRule two.\nRule three.';
        const rules = resolveRules(makeConfig({ prompt, promptMode: PromptMode.REPLACE }));

        expect(rules).toHaveLength(1);
        expect(rules[0]).toBe(prompt);
    });
});
