import type { Repo } from "@sourcebot/db";
import { execFile } from "child_process";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Settings } from "./types.js";
import { indexGitRepository } from "./zoekt.js";

vi.mock("child_process", () => ({
    execFile: vi.fn((_file, _args, _options, callback) => {
        callback(null, "", "");
    }),
}));

vi.mock("@sourcebot/shared", () => ({
    createLogger: vi.fn(() => ({
        debug: vi.fn(),
        warn: vi.fn(),
    })),
    env: {},
    getRepoPath: vi.fn(() => ({
        path: "/tmp/repo.git",
    })),
}));

vi.mock("./constants.js", () => ({
    INDEX_CACHE_DIR: "/tmp/index",
}));

vi.mock("./utils.js", () => ({
    getShardPrefix: vi.fn(() => "1_2"),
}));

describe("indexGitRepository", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("preserves revision names with punctuation", async () => {
        const repo = {
            id: 2,
            orgId: 1,
        } as Repo;
        const settings = {
            maxTrigramCount: 100,
            maxFileSize: 200,
        } as Settings;
        const payloadBranch = 'refs/heads/release";metadata${IFS}v1;"x';

        await indexGitRepository(repo, settings, [
            "refs/heads/main",
            payloadBranch,
        ]);

        expect(execFile).toHaveBeenCalledWith(
            "zoekt-git-index",
            [
                "-allow_missing_branches",
                "-index", "/tmp/index",
                "-max_trigram_count", "100",
                "-file_limit", "200",
                "-branches", `refs/heads/main,${payloadBranch}`,
                "-tenant_id", "1",
                "-repo_id", "2",
                "-shard_prefix_override", "1_2",
                "/tmp/repo.git",
            ],
            {},
            expect.any(Function),
        );
    });
});
