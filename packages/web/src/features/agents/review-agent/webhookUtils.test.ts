import { expect, test, vi, describe, beforeEach } from 'vitest';
import { AgentConfig, AgentScope, AgentType, PromptMode } from '@sourcebot/db';

// Use vi.hoisted so the env object can be mutated per-test before module load.
const mocks = vi.hoisted(() => ({
    env: {
        REVIEW_AGENT_AUTO_REVIEW_ENABLED: undefined as string | undefined,
        REVIEW_AGENT_REVIEW_COMMAND: 'review',
    },
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
    env: mocks.env,
}));

// app.ts is imported by webhookUtils — keep its heavy node dependencies quiet.
vi.mock('@/features/agents/review-agent/nodes/generatePrReview', () => ({ generatePrReviews: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/githubPushPrReviews', () => ({ githubPushPrReviews: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/githubPrParser', () => ({ githubPrParser: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/invokeDiffReviewLlm', () => ({ getReviewAgentLogDir: vi.fn(() => '/tmp'), invokeDiffReviewLlm: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/gitlabMrParser', () => ({ gitlabMrParser: vi.fn() }));
vi.mock('@/features/agents/review-agent/nodes/gitlabPushMrReviews', () => ({ gitlabPushMrReviews: vi.fn() }));

import { isAutoReviewEnabled, getReviewCommand } from './webhookUtils';

function makeConfig(settings: Record<string, unknown> = {}): AgentConfig {
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
        settings: settings as AgentConfig['settings'],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

beforeEach(() => {
    mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = undefined;
    mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'review';
});

// ─── isAutoReviewEnabled ─────────────────────────────────────────────────────

describe('isAutoReviewEnabled', () => {
    test('returns true when no config and env flag is not set', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = undefined;

        expect(isAutoReviewEnabled(null)).toBe(true);
    });

    test('returns true when no config and env flag is set to "true"', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = 'true';

        expect(isAutoReviewEnabled(null)).toBe(true);
    });

    test('returns false when no config and env flag is "false"', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = 'false';

        expect(isAutoReviewEnabled(null)).toBe(false);
    });

    test('per-config true overrides env "false"', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = 'false';

        expect(isAutoReviewEnabled(makeConfig({ autoReviewEnabled: true }))).toBe(true);
    });

    test('per-config false overrides env "true"', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = 'true';

        expect(isAutoReviewEnabled(makeConfig({ autoReviewEnabled: false }))).toBe(false);
    });

    test('per-config false overrides unset env (which would default to true)', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = undefined;

        expect(isAutoReviewEnabled(makeConfig({ autoReviewEnabled: false }))).toBe(false);
    });

    test('falls back to env when config has no autoReviewEnabled setting', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = 'false';

        expect(isAutoReviewEnabled(makeConfig({}))).toBe(false);
    });

    test('returns true when config is provided but has no settings at all', () => {
        mocks.env.REVIEW_AGENT_AUTO_REVIEW_ENABLED = undefined;

        expect(isAutoReviewEnabled(makeConfig({}))).toBe(true);
    });
});

// ─── getReviewCommand ────────────────────────────────────────────────────────

describe('getReviewCommand', () => {
    test('returns the env default when config is null', () => {
        mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'review';

        expect(getReviewCommand(null)).toBe('review');
    });

    test('returns the env default when config has no reviewCommand', () => {
        mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'review';

        expect(getReviewCommand(makeConfig({}))).toBe('review');
    });

    test('returns per-config command over the env default', () => {
        mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'review';

        expect(getReviewCommand(makeConfig({ reviewCommand: 'check' }))).toBe('check');
    });

    test('per-config command is returned regardless of the env value', () => {
        mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'something-else';

        expect(getReviewCommand(makeConfig({ reviewCommand: 'security-review' }))).toBe('security-review');
    });

    test('returns the env value when config reviewCommand is an empty string (falsy)', () => {
        mocks.env.REVIEW_AGENT_REVIEW_COMMAND = 'review';

        // An empty string is falsy — should fall back to env
        expect(getReviewCommand(makeConfig({ reviewCommand: '' }))).toBe('review');
    });
});
