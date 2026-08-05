import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    env: {
        GITHUB_REVIEW_AGENT_APP_ID: "app-id",
        GITHUB_REVIEW_AGENT_APP_WEBHOOK_SECRET: "webhook-secret",
        GITHUB_REVIEW_AGENT_APP_PRIVATE_KEY_PATH: "/tmp/github-app.pem",
        REVIEW_AGENT_AUTO_REVIEW_ENABLED: "true",
        REVIEW_AGENT_REVIEW_COMMAND: "review",
    },
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
    readFileSync: vi.fn(() => "private-key"),
    verifyAndReceive: vi.fn(),
    getInstallationOctokit: vi.fn(),
    octokit: {
        rest: {
            pulls: {
                get: vi.fn(),
            },
        },
    },
    octokitDefaults: vi.fn((defaults: unknown) => ({ defaults })),
    processGitHubPullRequest: vi.fn(),
    processGitLabMergeRequest: vi.fn(),
}));

vi.mock("@sourcebot/shared", () => ({
    env: mocks.env,
    createLogger: () => mocks.logger,
}));

vi.mock("fs", () => ({
    default: {
        readFileSync: mocks.readFileSync,
    },
}));

vi.mock("octokit", () => ({
    App: vi.fn(function () {
        return {
            webhooks: {
                verifyAndReceive: mocks.verifyAndReceive,
            },
            getInstallationOctokit: mocks.getInstallationOctokit,
        };
    }),
    Octokit: {
        plugin: vi.fn(() => ({
            defaults: mocks.octokitDefaults,
        })),
    },
}));

vi.mock("@octokit/plugin-throttling", () => ({
    throttling: {},
}));

vi.mock("@gitbeaker/rest", () => ({
    Gitlab: vi.fn(),
}));

vi.mock("@/features/agents/review-agent/app", () => ({
    processGitHubPullRequest: mocks.processGitHubPullRequest,
    processGitLabMergeRequest: mocks.processGitLabMergeRequest,
}));

vi.mock("@/features/agents/review-agent/types", () => ({
    gitLabMergeRequestPayloadSchema: {
        safeParse: vi.fn(),
    },
    gitLabNotePayloadSchema: {
        safeParse: vi.fn(),
    },
}));

const importRoute = async () => {
    vi.resetModules();
    return import("./route");
};

const createGitHubRequest = (body: unknown, headers: Record<string, string> = {}) => (
    new NextRequest("https://sourcebot.example.com/api/webhook", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-github-event": "pull_request",
            "x-github-delivery": "delivery-id",
            ...headers,
        },
        body: JSON.stringify(body),
    })
);

describe("POST /api/webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.verifyAndReceive.mockResolvedValue(undefined);
        mocks.getInstallationOctokit.mockResolvedValue(mocks.octokit);
    });

    test("skips GitHub events without a signature", async () => {
        const { POST } = await importRoute();

        await POST(createGitHubRequest({
            action: "opened",
            installation: { id: 123 },
            repository: {
                url: "https://api.github.com/repos/sourcebot-dev/sourcebot",
            },
            pull_request: { number: 1 },
        }));

        expect(mocks.verifyAndReceive).not.toHaveBeenCalled();
        expect(mocks.getInstallationOctokit).not.toHaveBeenCalled();
        expect(mocks.processGitHubPullRequest).not.toHaveBeenCalled();
    });

    test("verifies GitHub events and ignores host headers when choosing the API base URL", async () => {
        const { POST } = await importRoute();
        const payload = {
            action: "opened",
            installation: { id: 123 },
            repository: {
                url: "https://ghe.example.com/api/v3/repos/sourcebot-dev/sourcebot",
            },
            pull_request: { number: 1 },
        };

        await POST(createGitHubRequest(payload, {
            "x-hub-signature-256": "sha256=signature",
            "x-github-enterprise-host": "other.example.com",
        }));

        expect(mocks.verifyAndReceive).toHaveBeenCalledWith({
            id: "delivery-id",
            name: "pull_request",
            payload: JSON.stringify(payload),
            signature: "sha256=signature",
        });
        expect(mocks.octokitDefaults).toHaveBeenCalledWith({ baseUrl: "https://api.github.com" });
        expect(mocks.octokitDefaults).toHaveBeenCalledWith({ baseUrl: "https://ghe.example.com/api/v3" });
        expect(mocks.octokitDefaults).not.toHaveBeenCalledWith({ baseUrl: "https://other.example.com/api/v3" });
        expect(mocks.getInstallationOctokit).toHaveBeenCalledWith(123);
        expect(mocks.processGitHubPullRequest).toHaveBeenCalledWith(mocks.octokit, payload.pull_request);
    });

    test("skips GitHub events with invalid repository API URLs", async () => {
        const { POST } = await importRoute();
        const payload = {
            action: "opened",
            installation: { id: 123 },
            repository: {
                url: "https://ghe.example.com/api/v3/projects/sourcebot-dev/sourcebot",
            },
            pull_request: { number: 1 },
        };

        await POST(createGitHubRequest(payload, {
            "x-hub-signature-256": "sha256=signature",
        }));

        expect(mocks.verifyAndReceive).toHaveBeenCalledWith({
            id: "delivery-id",
            name: "pull_request",
            payload: JSON.stringify(payload),
            signature: "sha256=signature",
        });
        expect(mocks.getInstallationOctokit).not.toHaveBeenCalled();
        expect(mocks.processGitHubPullRequest).not.toHaveBeenCalled();
    });

    test("skips GitHub events when verification fails", async () => {
        mocks.verifyAndReceive.mockRejectedValue(new Error("invalid signature"));
        const { POST } = await importRoute();
        const payload = {
            action: "opened",
            installation: { id: 123 },
            repository: {
                url: "https://api.github.com/repos/sourcebot-dev/sourcebot",
            },
            pull_request: { number: 1 },
        };

        await POST(createGitHubRequest(payload, {
            "x-hub-signature-256": "sha256=signature",
        }));

        expect(mocks.verifyAndReceive).toHaveBeenCalledWith({
            id: "delivery-id",
            name: "pull_request",
            payload: JSON.stringify(payload),
            signature: "sha256=signature",
        });
        expect(mocks.getInstallationOctokit).not.toHaveBeenCalled();
        expect(mocks.processGitHubPullRequest).not.toHaveBeenCalled();
    });
});
